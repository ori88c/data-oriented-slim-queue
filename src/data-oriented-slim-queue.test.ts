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

import { SlimQueue } from './data-oriented-slim-queue';

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

  let expectedNumberOfCapacityIncrements = 0;
  for (let currRepetition = 0; currRepetition < repetitionsCount; ++currRepetition) {
    expect(queue.isEmpty).toBe(true);
    expect(queue.size).toBe(0);
    expect(() => queue.firstIn).toThrow();

    // Push all items: 1, 2, 3,..., itemsCount (an ascending numeric sequence from
    // front to back).
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

    const snapshot = queue.getSnapshot();
    expect(snapshot.length).toBe(itemsCount);
    for (let ithItem = 1; ithItem <= itemsCount; ++ithItem) {
      expect(snapshot[ithItem - 1]).toBe(ithItem);
    }

    // Pop all items.
    const capacityBeforeRemoval = queue.capacity; // The capacity remains unchanged by pop operations.
    for (let ithRemovedItem = 1; ithRemovedItem <= itemsCount; ++ithRemovedItem) {
      const removedItem = queue.pop();
      expect(removedItem).toBe(ithRemovedItem)
      expect(queue.size).toBe(itemsCount - ithRemovedItem);
      expect(queue.capacity).toBe(capacityBeforeRemoval);
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
    test(
      'push all items, then pop all items, expecting no buffer reallocation ' +
      'due to sufficient initial capacity', async () => {
      const itemsCount = 116;
      const initialCapacity = itemsCount; // No buffer reallocations are expected.
      const capacityIncrementFactor = 1.5;

      pushAllPopAllTest(initialCapacity, capacityIncrementFactor, itemsCount);
    });

    test(
      'push all items, then pop all items, expecting buffer reallocations to occur ' +
      'due to insufficient initialCapacity', async () => {
      // This test ensures validity following multiple internal buffer reallocations.
      const itemsCount = 803;
      const initialCapacity = 1; // Small initial capacity, to trigger many buffer reallocations.
      const capacityIncrementFactor = 1.1; // Relatively small factor, to trigger multiple buffer re-allocations.

      pushAllPopAllTest(initialCapacity, capacityIncrementFactor, itemsCount);
    });

    test('push items, clear the queue, validate successful clearing, and repeat', async () => {
      const repetitionsCount = 5;
      const itemsCount = 48;
      const queue = new SlimQueue<string>();

      const createItem = (ithItem: number) => `ITEM_PREFIX_${ithItem}`;
      const firstItem = createItem(1);
      for (let currRepetition = 0; currRepetition < repetitionsCount; ++currRepetition) {
        for (let ithItem = 1; ithItem <= itemsCount; ++ithItem) {
          const currItem = createItem(ithItem);
          queue.push(currItem);
        }

        expect(queue.size).toBe(itemsCount);
        expect(queue.isEmpty).toBe(false);
        expect(queue.firstIn).toBe(firstItem);
        queue.clear();
        expect(queue.size).toBe(0);
        expect(queue.isEmpty).toBe(true);
      }
    });

    test(
      'push a random number of items, then pop a random number of items, ' +
      'perform validations including snapshot validity, and repeat the process', async () => {
      const numberOfMainLoopRepetitions = 65; // Sufficiently big to observe statistical errors (such should not exist).
      const maxRepetitionsForOperationBatch = 76;
      let nextItemValue = -1403;
      let expectedFirstIn = nextItemValue;
      let expectedSize = 0;

      // The items invariant ensures that items are ordered in an ascending numeric sequence:
      // -k, -k+1, ..., 0, 1, 2, ..., m-1, m, from front to back (first-in to last-in).
      const queue = new SlimQueue<number>(); // Default params (initial capacity, capacity increment factor).

      const pushAndValidate = (): void => {
        queue.push(nextItemValue++);
        ++expectedSize;

        expect(queue.size).toBe(expectedSize);
        expect(queue.isEmpty).toBe(false);
        expect(queue.firstIn).toBe(expectedFirstIn);
      };

      const popAndValidate = (): void => {
        if (queue.isEmpty) {
          expect(() => queue.pop()).toThrow();
          return;
        }

        const removedItem = queue.pop();
        expect(removedItem).toBe(expectedFirstIn++);

        --expectedSize;
        expect(queue.size).toBe(expectedSize);
        expect(queue.isEmpty).toBe(expectedSize === 0);
        if (!queue.isEmpty) {
          expect(queue.firstIn).toBe(expectedFirstIn);
        }
      };

      const validateSnapshot = (): void => {
        const snapshot = queue.getSnapshot();
        expect(snapshot.length).toBe(queue.size);
        if (queue.isEmpty) {
          return;
        }

        let expectedCurrentItem = expectedFirstIn;
        for (const currentItem of snapshot) {
          expect(currentItem).toBe(expectedCurrentItem++);
        }
      };

      let remainedMainLoopIterations = numberOfMainLoopRepetitions;
      do {
        const pushCount = Math.ceil(Math.random() * maxRepetitionsForOperationBatch);
        const popCount = Math.ceil(Math.random() * maxRepetitionsForOperationBatch);

        for (let currPush = 1; currPush <= pushCount; ++currPush) {
          pushAndValidate();
        }

        validateSnapshot();

        for (let currPop = 1; currPop <= popCount; ++currPop) {
          popAndValidate();
        }

        validateSnapshot();
      } while (--remainedMainLoopIterations > 0);

      // Digest: clean the queue.
      while (expectedSize > 0) {
        popAndValidate();
      }
      validateSnapshot();
    });
  });

  describe('Negative path tests', () => {
    test('constructor should throw when the initial capacity is not a natural number', () => {
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

    test('should throw an error when accessing the firstIn getter on an empty instance', () => {
      const queue = new SlimQueue();
      expect(() => queue.firstIn).toThrow();
    });
  });
});
