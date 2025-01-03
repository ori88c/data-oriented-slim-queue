"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlimQueue = exports.DEFAULT_SLIM_QUEUE_CAPACITY_INCREMENT_FACTOR = exports.DEFAULT_SLIM_QUEUE_INITIAL_CAPACITY = void 0;
exports.DEFAULT_SLIM_QUEUE_INITIAL_CAPACITY = 128;
exports.DEFAULT_SLIM_QUEUE_CAPACITY_INCREMENT_FACTOR = 1.5;
const MIN_ALLOWED_CAPACITY_INCREMENT_FACTOR = 1.1;
const MAX_ALLOWED_CAPACITY_INCREMENT_FACTOR = 2;
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
class SlimQueue {
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
    constructor(initialCapacity = exports.DEFAULT_SLIM_QUEUE_INITIAL_CAPACITY, capacityIncrementFactor = exports.DEFAULT_SLIM_QUEUE_CAPACITY_INCREMENT_FACTOR) {
        this._headIndex = 0;
        this._size = 0;
        this._numberOfCapacityIncrements = 0;
        if (!isNaturalNumber(initialCapacity)) {
            throw new Error(`Failed to instantiate SlimQueue: initialCapacity must be a natural number, ` +
                `but received ${initialCapacity}`);
        }
        this._validateCapacityIncrementFactor(capacityIncrementFactor);
        this._cyclicBuffer = new Array(initialCapacity).fill(undefined);
        this._capacityIncrementFactor = capacityIncrementFactor;
    }
    /**
     * size
     *
     * @returns The number of items currently stored in the queue.
     */
    get size() {
        return this._size;
    }
    /**
     * isEmpty
     *
     * @returns True if and only if the queue does not contain any item.
     */
    get isEmpty() {
        return this._size === 0;
    }
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
    get capacity() {
        return this._cyclicBuffer.length;
    }
    /**
     * numberOfCapacityIncrements
     *
     * The `numberOfCapacityIncrements` getter is useful for metrics and monitoring.
     * A high number of capacity increments suggests that the initial capacity was underestimated.
     *
     * @returns The number of internal buffer reallocations due to insufficient capacity.
     */
    get numberOfCapacityIncrements() {
        return this._numberOfCapacityIncrements;
    }
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
    get firstIn() {
        if (this._size === 0) {
            throw new Error("SlimQueue 'firstIn' getter failed: the queue is empty");
        }
        return this._cyclicBuffer[this._headIndex];
    }
    /**
     * push
     *
     * Appends an item to the end of the queue (i.e., the Last In), increasing its size by one.
     *
     * @param item The item to add as the newest entry in the queue (i.e., the Last In).
     *             It will be removed by the `pop` method only after all existing items
     *             have been removed.
     */
    push(item) {
        this._increaseCapacityIfNecessary();
        const tailIndex = this._calculateExclusiveTailIndex();
        this._cyclicBuffer[tailIndex] = item;
        ++this._size;
    }
    /**
     * pop
     *
     * Removes and returns the oldest (First In) item from the queue, decreasing its size by one.
     *
     * @returns The item that was removed from the queue (the First In item).
     */
    pop() {
        if (this._size === 0) {
            throw new Error("SlimQueue 'pop' operation failed: the queue is empty");
        }
        const oldestItem = this._cyclicBuffer[this._headIndex];
        this._cyclicBuffer[this._headIndex] = undefined; // Help the garbage collector, avoid an unnecessary reference.
        if (++this._headIndex === this._cyclicBuffer.length) {
            this._headIndex = 0;
        }
        --this._size;
        return oldestItem;
    }
    /**
     * clear
     *
     * Removes all items from the queue, leaving it empty.
     */
    clear() {
        while (!this.isEmpty) {
            this.pop();
        }
        this._headIndex = 0;
    }
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
    getSnapshot() {
        const snapshot = new Array(this._size);
        let snapshotIndex = 0;
        this._traverseInOrder((currentBufferIndex) => {
            snapshot[snapshotIndex++] = this._cyclicBuffer[currentBufferIndex];
        });
        return snapshot;
    }
    _increaseCapacityIfNecessary() {
        const currCapacity = this._cyclicBuffer.length;
        if (this._size < currCapacity) {
            return;
        }
        const newCapacity = Math.ceil(currCapacity * this._capacityIncrementFactor);
        const newCyclicBuffer = new Array(newCapacity).fill(undefined);
        // In the new cyclic buffer we re-order items, such that head is located
        // at index 0.
        let newBufferLastOccupiedIndex = 0;
        this._traverseInOrder((currentBufferIndex) => {
            newCyclicBuffer[newBufferLastOccupiedIndex++] = this._cyclicBuffer[currentBufferIndex];
            this._cyclicBuffer[currentBufferIndex] = undefined;
        });
        this._headIndex = 0;
        this._cyclicBuffer = newCyclicBuffer;
        ++this._numberOfCapacityIncrements;
    }
    _calculateExclusiveTailIndex() {
        const tailIndex = this._headIndex + this._size;
        if (tailIndex < this._cyclicBuffer.length)
            return tailIndex;
        return tailIndex - this._cyclicBuffer.length;
    }
    _validateCapacityIncrementFactor(factor) {
        if (factor < MIN_ALLOWED_CAPACITY_INCREMENT_FACTOR) {
            throw new Error(`Failed to instantiate SlimQueue: The provided capacityIncrementFactor of ` +
                `${factor} is too small. The minimum allowed value is ${MIN_ALLOWED_CAPACITY_INCREMENT_FACTOR}`);
        }
        if (factor > MAX_ALLOWED_CAPACITY_INCREMENT_FACTOR) {
            throw new Error(`Failed to instantiate SlimQueue: The provided capacityIncrementFactor of ` +
                `${factor} is too large. The maximum allowed value is ${MIN_ALLOWED_CAPACITY_INCREMENT_FACTOR}`);
        }
    }
    /**
     * _traverseInOrder
     *
     * Facilitates traversing the items in the queue in order, from first-in to last-in.
     * The method accepts a callback, which is invoked with the current item index in
     * the internal cyclic buffer.
     *
     * @param callback The callback to execute, provided with the current item index.
     */
    _traverseInOrder(callback) {
        let itemsTraversed = 0;
        let currentBufferIndex = this._headIndex;
        while (itemsTraversed < this._size) {
            callback(currentBufferIndex);
            ++itemsTraversed;
            if (++currentBufferIndex === this._cyclicBuffer.length) {
                currentBufferIndex = 0;
            }
        }
    }
}
exports.SlimQueue = SlimQueue;
function isNaturalNumber(num) {
    const floored = Math.floor(num);
    return floored >= 1 && floored === num;
}
//# sourceMappingURL=data-oriented-slim-queue.js.map