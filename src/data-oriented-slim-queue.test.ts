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

import { DEFAULT_SLIM_QUEUE_CAPACITY_INCREMENT_FACTOR, DEFAULT_SLIM_QUEUE_INITIAL_CAPACITY, SlimQueue } from './data-oriented-slim-queue';

function getNewCapacity(oldCapacity: number, incrementFactor: number): number {
  return Math.ceil(oldCapacity * incrementFactor);
}

function pushAllPopAllTest(
  initialCapacity: number,
  capacityIncrementFactor: number,
  itemsCount: number
): void {
  const queue = new SlimQueue<number>(initialCapacity, capacityIncrementFactor);

  const repetitionsCount = 5; // Amount of push-all & pop-all repetitions.
  const firstItemValue = 1;
  const expectedPopOrder = [];

  // Items are 1,2,3,...
  for (let ithItem = 1; ithItem <= itemsCount; ++ithItem) {
    expectedPopOrder.push(ithItem);
  }

  let expectedNumberOfCapacityIncrements = 0;
  for (let currRepetition = 0; currRepetition < repetitionsCount; ++currRepetition) {
    expect(queue.isEmpty).toBe(true);
    expect(queue.size).toBe(0);
    expect(() => queue.firstIn).toThrow();

    // Push all items.
    for (let ithItem = 1; ithItem <= itemsCount; ++ithItem) {
      const oldCapacity = queue.capacity;
      const shouldTriggerCapacityIncrement = queue.size === queue.capacity;
      queue.push(ithItem);

      if (shouldTriggerCapacityIncrement) {
        ++expectedNumberOfCapacityIncrements;
        const expectedNewCapacity = getNewCapacity(oldCapacity, capacityIncrementFactor);
        expect(queue.capacity).toEqual(expectedNewCapacity);
      } else {
        expect(queue.capacity).toEqual(oldCapacity);
      }

      expect(queue.numberOfCapacityIncrements).toEqual(expectedNumberOfCapacityIncrements);
      expect(queue.isEmpty).toBe(false);
      expect(queue.size).toBe(ithItem);
      expect(queue.firstIn).toBe(firstItemValue);
    }

    // Pop all items.
    const capacityBeforeRemovingItems = queue.capacity; // Does not change following pop operations.
    for (let ithRemovedItem = 1; ithRemovedItem <= itemsCount; ++ithRemovedItem) {
      const removedItem = queue.pop();
      expect(removedItem).toBe(ithRemovedItem)
      expect(queue.size).toBe(itemsCount - ithRemovedItem);
      expect(queue.capacity).toBe(capacityBeforeRemovingItems);
      expect(queue.numberOfCapacityIncrements).toEqual(expectedNumberOfCapacityIncrements);

      if (ithRemovedItem === itemsCount) {
        // The last removed item.
        expect(queue.isEmpty).toBe(true);
        expect(() => queue.firstIn).toThrow();
      } else {
        expect(queue.isEmpty).toBe(false);
        expect(queue.firstIn).toBe(ithRemovedItem + 1);
      }
    }
  }
}

describe('SlimQueue tests', () => {
  describe('Happy path tests', () => {
    test('push all items, then pop all items, no buffer reallocation due to sufficient initialCapacity', async () => {
      const itemsCount = 116;
      const initialCapacity = itemsCount; // No buffer reallocations are expected.
      const capacityIncrementFactor = 1.5;

      pushAllPopAllTest(initialCapacity, capacityIncrementFactor, itemsCount);
    });

    test('push all items, then pop all items, buffer reallocation should occur due to insufficient initialCapacity', async () => {
      // This test ensures validity following multiple internal buffer reallocations.
      const itemsCount = 412;
      const initialCapacity = 1; // Small initial capacity, to trigger many buffer reallocations.
      const capacityIncrementFactor = 1.1; // Relatively small factor, to trigger multiple buffer re-allocations.

      pushAllPopAllTest(initialCapacity, capacityIncrementFactor, itemsCount);
    });

    test('push items, clear the queue, validate successful clearing, repeatedly', async () => {
      const repetitionsCount = 5;
      const itemsCount = 48;
      const queue = new SlimQueue<string>();

      for (let currRepetition = 0; currRepetition < repetitionsCount; ++currRepetition) {
        for (let ithItem = 1; ithItem <= itemsCount; ++ithItem) {
          queue.push(`ITEM_PREFIX_${ithItem}`);
        }

        expect(queue.size).toBe(itemsCount);
        expect(queue.isEmpty).toBe(false);
        expect(queue.firstIn).toBe("ITEM_PREFIX_1");
        queue.clear();
        expect(queue.size).toBe(0);
        expect(queue.isEmpty).toBe(true);
      }
    });

    test('push random amount of items, then pop random amount of items, repeatedly', async () => {
      const mainLoopRepetitions = 51; // Sufficiently big to observe statistical errors (such should not exist).
      const maxRepetitionsForOperationBatch = 76;
      const expectedInternalState: number[] = []; // Left to Right -> First In to Last In.
      let nextItemValue = -1451;
      let expectedSize = 0;
      let expectedNumberOfCapacityIncrements = 0;
      let expectedCapacity = DEFAULT_SLIM_QUEUE_INITIAL_CAPACITY;

      const queue = new SlimQueue<number>(); // Default params (initial capacity, capacity increment factor.)

      const validatePush = () => {
        if (queue.size === queue.capacity) {
          // A buffer re-allocation is expected to be triggered.
          ++expectedNumberOfCapacityIncrements;
          expectedCapacity = getNewCapacity(expectedCapacity, DEFAULT_SLIM_QUEUE_CAPACITY_INCREMENT_FACTOR);
        }

        queue.push(nextItemValue);
        expectedInternalState.push(nextItemValue);
        ++nextItemValue;
        ++expectedSize;

        expect(queue.size).toBe(expectedSize);
        expect(queue.size).toBe(expectedInternalState.length);
        expect(queue.isEmpty).toBe(false);
        expect(queue.firstIn).toBe(expectedInternalState[0]);
        expect(queue.capacity).toBe(expectedCapacity);
        expect(queue.numberOfCapacityIncrements).toBe(expectedNumberOfCapacityIncrements);
      };

      const validatePopFromNonEmptyQueue = () => {
        const expectedRemovedItem = expectedInternalState[0];
        const removedItem = queue.pop();
        expect(removedItem).toBe(expectedRemovedItem);

        expectedInternalState.shift(); // Inefficient O(n), yet sufficient for testing purposes.
        --expectedSize;
        expect(queue.size).toBe(expectedSize);
        expect(queue.size).toBe(expectedInternalState.length);
        expect(queue.capacity).toBe(expectedCapacity);
        expect(queue.numberOfCapacityIncrements).toBe(expectedNumberOfCapacityIncrements);
        expect(queue.isEmpty).toBe(expectedSize === 0);
        if (!queue.isEmpty) {
          expect(queue.firstIn).toBe(expectedInternalState[0]);
        }
      };

      let remainedMainLoopIterations = mainLoopRepetitions;
      do {
        const pushCount = Math.ceil(Math.random() * maxRepetitionsForOperationBatch);
        const popCount = Math.ceil(Math.random() * maxRepetitionsForOperationBatch);

        for (let currPush = 1; currPush <= pushCount; ++currPush) {
          validatePush();
        }

        for (let currPop = 1; currPop <= popCount; ++currPop) {
          if (expectedSize === 0) {
            expect(queue.isEmpty).toBe(true);
            expect(queue.size).toBe(0);
            expect(queue.capacity).toBe(expectedCapacity);
            expect(queue.numberOfCapacityIncrements).toBe(expectedNumberOfCapacityIncrements);
            expect(() => queue.firstIn).toThrow();
            expect(expectedInternalState.length).toBe(0);
            continue;
          }

          // Non empty queue.
          validatePopFromNonEmptyQueue();
        }
      } while (--remainedMainLoopIterations > 0);

      while (expectedSize > 0) {
        validatePopFromNonEmptyQueue();
      }
    });
  });

  describe('Negative path tests', () => {
    test('constructor should throw when initial capacity is not a natural number', () => {
      const nonNaturalNumbers = [-74, -65, -5.67, -0.00001, 0, 0.1, 0.08974, 9.543, 1898.5, 4000.0000001];
      for (const invalidInitialCapacity of nonNaturalNumbers) {
        expect(() => new SlimQueue(invalidInitialCapacity)).toThrow();
      }
    });

    test('constructor should throw when the capacity increment factor is too small', () => {
      const validInitialCapacity = 256;
      const tooSmallIncrementFactor = [-74, -65, -5.67, -0.00001, 0, 0.1, 0.08974, 1, 1.0001, 1.0009, 1.09, 1.099];
      for (const factor of tooSmallIncrementFactor) {
        expect(() => new SlimQueue(validInitialCapacity, factor)).toThrow();
      }
    });

    test('constructor should throw when the capacity increment factor is too big', () => {
      const validInitialCapacity = 180;
      const tooBigIncrementFactor = [2.0001, 2.01, 2.1, 2.544, 40, 56.498];
      for (const factor of tooBigIncrementFactor) {
        expect(() => new SlimQueue(validInitialCapacity, factor)).toThrow();
      }
    });

    test('should throw when triggering the firstIn getter on an empty instance', () => {
      const queue = new SlimQueue();
      expect(() => queue.firstIn).toThrow();
    });
  });
});
