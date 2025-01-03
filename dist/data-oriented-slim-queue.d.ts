/**
 * Copyright 2024 Ori Cohen https://github.com/ori88c
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
export declare const DEFAULT_SLIM_QUEUE_INITIAL_CAPACITY = 128;
export declare const DEFAULT_SLIM_QUEUE_CAPACITY_INCREMENT_FACTOR = 1.5;
/**
 * SlimQueue
 *
 * The `SlimQueue` class implements an in-memory queue with a basic API, targeting pure FIFO use
 * cases like task queues, breadth-first search (BFS), and similar scenarios.
 *
 * ### Data-Oriented Design
 * This implementation follows the principles of Data-Oriented Design (DOD), optimizing memory layout
 * and access patterns using arrays, particularly to enhance CPU cache efficiency.
 * Unlike Object-Oriented Programming (OOP), where each object may be allocated in disparate locations
 * on the heap, DOD leverages the sequential allocation of arrays, reducing the likelihood of cache misses.
 *
 * ### Focused API
 * This package provides a queue and nothing more. The absence of linear operations like iteration
 * and splicing reflects a deliberate design choice, as resorting to such methods often indicates that
 * a queue may not have been the most appropriate data structure in the first place.
 *
 * ### Terminology
 * The 'push' and 'pop' terminology is inspired by std::queue in C++.
 * Unlike more complex data structures, a queue only allows pushing in one direction and popping from the
 * other, making this straightforward terminology appropriate.
 * The `firstIn` getter provides access to the next item to be removed. This is useful in scenarios where
 * items are removed based on a specific condition. For example, in a Rate Limiter that restricts the number
 * of requests within a time window, an ascending queue of timestamps might represent request times. To determine
 * whether a new request can be processed, you can check the queue's size and the oldest timestamp within the
 * current window, which is the `firstIn` value.
 */
export declare class SlimQueue<T> {
    private _cyclicBuffer;
    private _headIndex;
    private _size;
    private _numberOfCapacityIncrements;
    private readonly _capacityIncrementFactor;
    /**
     * Constructor
     *
     * The `SlimQueue` constructor allows precise control over the initial capacity
     * and the increment factor of the internal queue buffer.
     *
     * The initial capacity defines the number of pre-allocated slots in the buffer.
     * As long as the number of queue items does not exceed this capacity, no buffer
     * reallocation is required. Since buffer reallocation is an O(new buffer size)
     * operation, it is advisable to set the initial capacity to match the expected
     * maximum queue size if known in advance.
     *
     * If the number of items exceeds the current capacity, a new internal buffer
     * will be allocated, and all existing items will be transferred to this new
     * buffer. The size of the new buffer will be `oldBufferSize * capacityIncrementFactor`.
     * For example, if the initial capacity is 100 and the increment factor is 2,
     * the queue will allocate a new buffer of 200 slots before adding the 101th item.
     *
     * ### Considerations
     * A small initial capacity may lead to frequent dynamic memory reallocations,
     * potentially causing latency spikes. Conversely, an overly large initial capacity
     * may result in wasted memory. Each use case should weigh the trade-offs between
     * these factors. Ideally, the maximum queue size is known in advance, making
     * the increment factor unnecessary.
     *
     * @param initialCapacity The initial size of the queue's internal buffer.
     * @param capacityIncrementFactor The factor by which the buffer size is increased
     *                                when the current buffer is full.
     *                                Must be in the range [1.1, 2].
     */
    constructor(initialCapacity?: number, capacityIncrementFactor?: number);
    /**
     * size
     *
     * @returns The number of items currently stored in the queue.
     */
    get size(): number;
    /**
     * isEmpty
     *
     * @returns True if and only if the queue does not contain any item.
     */
    get isEmpty(): boolean;
    /**
     * capacity
     *
     * The `capacity` getter is useful for metrics and monitoring.
     * If the observed capacity remains significantly larger than the queue's size after the
     * initial warm-up period, it may indicate that the initial capacity was overestimated.
     * Conversely, if the capacity has grown excessively due to buffer reallocations, it may
     * suggest that the initial capacity was underestimated.
     *
     * @returns The length of the internal buffer storing items.
     */
    get capacity(): number;
    /**
     * numberOfCapacityIncrements
     *
     * The `numberOfCapacityIncrements` getter is useful for metrics and monitoring.
     * A high number of capacity increments suggests that the initial capacity was underestimated.
     *
     * @returns The number of internal buffer reallocations due to insufficient capacity.
     */
    get numberOfCapacityIncrements(): number;
    /**
     * firstIn
     *
     * Returns a reference to the oldest item currently stored in the queue.
     *
     * Commonly used in scenarios like sliding-window algorithms, where items
     * are conditionally removed based on an out-of-window indicator.
     *
     * @returns The "First In" item, i.e., the oldest item in the queue,
     *          which will be removed during the next `pop` operation.
     */
    get firstIn(): T;
    /**
     * push
     *
     * Appends an item to the end of the queue (i.e., the Last In), increasing its size by one.
     *
     * @param item The item to add as the newest entry in the queue (i.e., the Last In).
     *             It will be removed by the `pop` method only after all existing items
     *             have been removed.
     */
    push(item: T): void;
    /**
     * pop
     *
     * Removes and returns the oldest (First In) item from the queue, decreasing its size by one.
     *
     * @returns The item that was removed from the queue (the First In item).
     */
    pop(): T;
    /**
     * clear
     *
     * Removes all items from the queue, leaving it empty.
     */
    clear(): void;
    /**
     * getSnapshot
     *
     * Returns an array of references to all the currently stored items in the queue,
     * ordered from First-In to Last-In.
     *
     * This method can be used, for example, to periodically log the K most recent metrics,
     * such as CPU or memory usage.
     *
     * @returns An array of references to the queue's items, ordered from First-In to Last-In.
     */
    getSnapshot(): T[];
    private _increaseCapacityIfNecessary;
    private _calculateExclusiveTailIndex;
    private _validateCapacityIncrementFactor;
    /**
     * _traverseInOrder
     *
     * Facilitates traversing the items in the queue in order, from first-in to last-in.
     * The method accepts a callback, which is invoked with the current item index in
     * the internal cyclic buffer.
     *
     * @param callback The callback to execute, provided with the current item index.
     */
    private _traverseInOrder;
}
