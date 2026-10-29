// Min-heap van vaste sorteerrangen, gedeeld door taakkeuze en de voorwaartse nivelleerpass.
export class LevelingQueue {
  private ranks: number[] = [];

  peek(): number | undefined { return this.ranks[0]; }

  push(rank: number): void {
    this.ranks.push(rank);
    let i = this.ranks.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.ranks[parent] <= this.ranks[i]) break;
      [this.ranks[parent], this.ranks[i]] = [this.ranks[i], this.ranks[parent]];
      i = parent;
    }
  }

  pop(): number | undefined {
    if (this.ranks.length === 0) return undefined;
    const top = this.ranks[0];
    const last = this.ranks.pop()!;
    if (this.ranks.length > 0) {
      this.ranks[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < this.ranks.length && this.ranks[l] < this.ranks[m]) m = l;
        if (r < this.ranks.length && this.ranks[r] < this.ranks[m]) m = r;
        if (m === i) break;
        [this.ranks[m], this.ranks[i]] = [this.ranks[i], this.ranks[m]];
        i = m;
      }
    }
    return top;
  }
}
