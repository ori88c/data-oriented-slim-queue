<h2 align="middle">Data Oriented Slim Queue</h2>

The `SlimQueue` class implements an in-memory queue with a basic API, targeting pure use cases like task queues, breadth-first search (BFS), and similar scenarios.

## Data-Oriented Design

This implementation follows the principles of Data-Oriented Design (DOD), optimizing memory layout and access patterns using arrays, particularly to enhance CPU cache efficiency. Unlike Object-Oriented Programming (OOP), where each object may be allocated in disparate locations on the heap, DOD leverages the sequential allocation of arrays, reducing the likelihood of cache misses.

## Focused API

This package provides a queue and nothing more. The absence of linear operations like iteration and splicing reflects a deliberate design choice, as resorting to such methods often indicates that a queue may not have been the most appropriate data structure in the first place.

## Key Features :sparkles:

- __Basic Queue API__: Straightforward and simple API, targeting pure use-cases of queues.
- __Efficiency__: Featuring a Data-Oriented Design with capacity-tuning capability, to reduce or prevent reallocations of the internal cyclic buffer. 
- __Comprehensive documentation__: The class is thoroughly documented, enabling IDEs to provide helpful tooltips that enhance the coding experience.
- __Tests__: Fully covered by unit tests.
- No external runtime dependencies: Only development dependencies are used.
- ES2020 Compatibility: The `tsconfig` target is set to ES2020, ensuring compatibility with ES2020 environments.
- TypeScript support.

## API

The `push` and `pop` terminology is inspired by std::queue in C++. Unlike more complex data structures, a queue only allows pushing in one direction and popping from the other, making this straightforward terminology appropriate.  
The `clear` method removes all items from the queue, leaving it empty. 

The `firstIn` getter provides access to the next item to be removed. This is useful in scenarios where items are removed based on a specific condition. For example, in a Rate Limiter that restricts the number of requests within a time window, an ascending queue of timestamps might represent execution times. To determine whether a new request can be processed, you can check the queue's size and the oldest timestamp within the current window, which is the `firstIn` value.

The `size` getter returns the amount of items currently stored in the queue.

The `isEmpty` getter returns true if and only if the current `size` is 0.

The `capacity` getter returns the size of the internal cyclic buffer, while `numberOfCapacityIncrements` provides the number of capacity increments that have occurred during the instance's lifespan. A separate section will be dedicated to discussing capacity considerations.

## Use Case Example: Rate Limiting

Consider a component designed for rate-limiting promises using a sliding-window approach. Suppose a window duration of `windowDurationMs` milliseconds, with a maximum of `tasksPerWindow` tasks allowed within each window. The rate limiter will only trigger the execution of a task if fewer than `tasksPerWindow` tasks have started execution within the time window `[now - windowDurationMs, now]`.  
For simplicity, this example focuses on a single method that initiates task execution only if the current window's limit has not been reached. If the limit has been exceeded, an error is thrown.
In this scenario, we employ the `isEmpty`, `firstIn`, and `size` getters, along with the `push` and `pop` methods.

```ts
import { SlimQueue } from 'data-oriented-slim-queue';

type RateLimiterTask<T> = () => Promise<T>;

class RateLimiter<T> {
  // Monotonic queue of ascending task-execution timestamps.
  private readonly _ascWindowTimestamps = new SlimQueue<number>();

  constructor(
    private readonly _windowDurationMs: number,
    private readonly _tasksPerWindow: number
  ) { 
    // ...
  }

  public async tryExecutingTask(task: RateLimiterTask): Promise<T> {
    // Evict out-of-window past execution timestamps.
    const absoluteNow: number = Date.now();
    while (
      !this._ascWindowTimestamps.isEmpty &&
      (absoluteNow - this._ascWindowTimestamps.firstIn) >= this._windowDurationMs
    ) {
      this._ascWindowTimestamps.pop();
    }

    if (this._ascWindowTimestamps.size === this._tasksPerWindow) {
      throw new RateLimiterThrottlingError();
    }

    this._ascWindowTimestamps.push(absoluteNow);
    return await task();
  }
}
```

## Capacity Tunning :rocket:

The `SlimQueue` constructor allows precise control over the initial capacity and the increment factor of the internal queue buffer.
```ts
constructor(
  initialCapacity: number = DEFAULT_SLIM_QUEUE_INITIAL_CAPACITY,
  capacityIncrementFactor: number = DEFAULT_SLIM_QUEUE_CAPACITY_INCREMENT_FACTOR
)
```

The initial capacity defines the number of pre-allocated slots in the buffer. As long as the number of queue items does not exceed this capacity, no buffer reallocation is required. Since buffer reallocation is an `O(new buffer size)` operation, it is advisable to set the initial capacity to match the expected maximum queue size if known in advance.

If the number of items exceeds the current capacity, a new internal buffer will be allocated, and all existing items will be transferred to this new buffer. The size of the new buffer will be `oldBufferSize * capacityIncrementFactor`.  
For example, if the initial capacity is 100 and the increment factor is 2, the queue will allocate a new buffer of 200 slots before adding the 101st item.  
Note: The valid range of `capacityIncrementFactor` is **[1.1, 2]**. Any out-of-range factor will cause the constructor to throw an error.

A small initial capacity may lead to frequent dynamic memory reallocations, potentially causing latency spikes. Conversely, an overly large initial capacity may result in wasted memory. Each use case should weigh the trade-offs between these factors. Ideally, the maximum queue size is known in advance, making the increment factor unnecessary.

## License :scroll:

[Apache 2.0](LICENSE)
