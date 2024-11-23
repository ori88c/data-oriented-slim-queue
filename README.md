<h2 align="middle">Data Oriented Slim Queue</h2>

The `SlimQueue` class implements an in-memory queue with a basic API, targeting pure FIFO use cases such as task queues, breadth-first search (BFS), and similar scenarios.

This versatile data structure is commonly associated with task prioritization, ensuring tasks are processed in order. It also proves valuable in optimizing sliding-window algorithms, where the oldest item (First In) is evicted based on a specific indicator.

## Data-Oriented Design :gear:

This implementation follows the principles of Data-Oriented Design (DOD), optimizing memory layout and access patterns using arrays, particularly to enhance CPU cache efficiency. Unlike Object-Oriented Programming (OOP), where each object may be allocated in disparate locations on the heap, DOD leverages the sequential allocation of arrays, reducing the likelihood of cache misses.

## Focused API :dart:

This package provides a queue and nothing more. The absence of linear operations like iteration and splicing reflects a deliberate design choice, as resorting to such methods often indicates that a queue may not have been the most appropriate data structure in the first place.  
The sole exception is the `getSnapshot` method, included to support metrics or statistical analysis, particularly in use cases like tracking the K most recent items.

## Table of Contents :bookmark_tabs:

* [Key Features](#key-features)
* [API](#api)
* [Getter Methods](#getter-methods)
* [Use Case Example: Rate Limiting](#use-case-example)
* [Capacity Tunning](#capacity-tuning)
* [License](#license)

## Key Features :sparkles:<a id="key-features"></a>

- __Basic Queue API__: Targeting pure use-cases of queues.
- __Efficiency :gear:__: Featuring a Data-Oriented Design with capacity-tuning capability, to reduce or prevent reallocations of the internal cyclic buffer.
- __Comprehensive Documentation :books:__: The class is thoroughly documented, enabling IDEs to provide helpful tooltips that enhance the coding experience.
- __Tests :test_tube:__: **Fully covered** by comprehensive unit tests, including **randomized simulations** of real-life scenarios and validations to ensure proper internal capacity scaling.
- **TypeScript** support.
- No external runtime dependencies: Only development dependencies are used.
- ES2020 Compatibility: The `tsconfig` target is set to ES2020, ensuring compatibility with ES2020 environments.

## API :globe_with_meridians:<a id="api"></a>

The `SlimQueue` class provides the following methods:

* __push__: Appends an item to the end of the queue (i.e., the Last In), increasing its size by one.
* __pop__: Removes and returns the oldest (First In) item from the queue, decreasing its size by one.
* __clear__: Removes all items from the queue, leaving it empty.
* __getSnapshot__: Returns an array of references to all the currently stored items in the queue, ordered from First-In to Last-In.

If needed, refer to the code documentation for a more comprehensive description.

The `push` and `pop` terminology is inspired by std::queue in C++. Unlike more complex data structures, a queue only allows pushing in one direction and popping from the other, making this straightforward terminology appropriate.  

## Getter Methods :mag:<a id="getter-methods"></a>

The `SlimQueue` class provides the following getter methods to reflect the current state:

* __size__: The amount of items currently stored in the queue.
* __isEmpty__: Indicates whether the queue does not contain any item.
* __firstIn__: Returns a reference to the oldest item currently stored in the queue (the First In item), which will be removed during the next pop operation.
* __capacity__: The length of the internal buffer storing items. If the observed capacity remains significantly larger than the queue's size after the initial warm-up period, it may indicate that the initial capacity was overestimated. Conversely, if the capacity has grown excessively due to buffer reallocations, it may suggest that the initial capacity was underestimated.
* __numberOfCapacityIncrements__: The number of internal buffer reallocations due to insufficient capacity that have occurred during the instance's lifespan. A high number of capacity increments suggests that the initial capacity was underestimated.

To eliminate any ambiguity, all getter methods have **O(1)** time and space complexity.

## Use Case Example: Rate Limiting :man_technologist:<a id="use-case-example"></a>

Consider a component designed for rate-limiting promises using a sliding-window approach. Suppose a window duration of `windowDurationMs` milliseconds, with a maximum of `tasksPerWindow` tasks allowed within each window. The rate limiter will only trigger the execution of a task if fewer than `tasksPerWindow` tasks have started execution within the time window `[now - windowDurationMs, now]`.

For simplicity, this example focuses on a single method that initiates task execution only if the current window's limit has not been reached. If the limit has been exceeded, an error is thrown.
In this scenario, we employ the `isEmpty`, `firstIn`, and `size` getters, along with the `push` and `pop` methods.

```ts
import { SlimQueue } from 'data-oriented-slim-queue';

type RateLimiterTask<T> = () => Promise<T>;

class RateLimiterThrottlingError extends Error { /* ... */ }

class RateLimiter<T> {
  // Monotonic queue of ascending task-execution timestamps.
  private readonly _ascWindowTimestamps: SlimQueue<number>;

  constructor(
    private readonly _windowDurationMs: number,
    private readonly _tasksPerWindow: number
  ) { 
    // The maximum queue size is predetermined.
    // Leveraging this knowledge, we initialize with a capacity equal to the maximum,
    // avoiding unnecessary internal reallocations.
    this._ascWindowTimestamps = new SlimQueue<number>(this._tasksPerWindow);
  }

  public async tryExecutingTask(task: RateLimiterTask<T>): Promise<T> {
    // Evict out-of-window past execution timestamps.
    const now: number = Date.now();
    while (this._isOutdatedFirstIn(now)) {
      this._ascWindowTimestamps.pop();
    }

    if (this._ascWindowTimestamps.size === this._tasksPerWindow) {
      throw new RateLimiterThrottlingError();
    }

    this._ascWindowTimestamps.push(now);
    return task();
  }

  // Eviction indicator.
  private _isOutdatedFirstIn(now: number): boolean {
    if (this._ascWindowTimestamps.isEmpty) {
      return false;
    }

    const elapsedMsSinceOldestTimestamp = now - this._ascWindowTimestamps.firstIn;
    return elapsedMsSinceOldestTimestamp >= this._windowDurationMs;
  }
}
```

## Capacity Tunning :wrench:<a id="capacity-tuning"></a>

The `SlimQueue` constructor allows precise control over the initial capacity and the increment factor of the internal queue buffer.
```ts
constructor(
  initialCapacity: number = DEFAULT_SLIM_QUEUE_INITIAL_CAPACITY,
  capacityIncrementFactor: number = DEFAULT_SLIM_QUEUE_CAPACITY_INCREMENT_FACTOR
)
```

The initial capacity defines the number of pre-allocated slots in the buffer. As long as the number of queue items does not exceed this capacity, no buffer reallocation is required. Since buffer reallocation is an `O(new buffer size)` operation, it is advisable to set the initial capacity to match the expected maximum queue size, if known in advance.

If the number of items exceeds the current capacity, a new internal buffer will be allocated, and all existing items will be transferred to this new buffer. The size of the new buffer will be `oldBufferSize * capacityIncrementFactor`.  
For example, if the initial capacity is 100 and the increment factor is 2, the queue will allocate a new buffer of 200 slots before adding the 101st item.  
Note: The valid range of `capacityIncrementFactor` is **[1.1, 2]**. Any out-of-range factor will cause the constructor to throw an error.

A small initial capacity may lead to frequent dynamic memory reallocations, potentially causing latency spikes. Conversely, an overly large initial capacity may result in wasted memory. Each use case should **weigh the trade-offs** between these factors. Ideally, the maximum queue size is known in advance, making the increment factor unnecessary.

## License :scroll:<a id="license"></a>

[Apache 2.0](LICENSE)
