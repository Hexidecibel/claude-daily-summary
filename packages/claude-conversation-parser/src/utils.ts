/**
 * A Map with a maximum size. When the limit is exceeded, the oldest half of entries
 * are removed (by insertion order, which JS Maps preserve).
 */
export class BoundedMap<K, V> extends Map<K, V> {
  private maxSize: number;

  constructor(maxSize: number) {
    super();
    this.maxSize = maxSize;
  }

  set(key: K, value: V): this {
    super.set(key, value);
    if (this.size > this.maxSize) {
      this.evict();
    }
    return this;
  }

  private evict(): void {
    const toDelete = Math.floor(this.size / 2);
    let count = 0;
    for (const key of this.keys()) {
      if (count >= toDelete) break;
      this.delete(key);
      count++;
    }
  }
}
