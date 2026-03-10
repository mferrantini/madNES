/**
 * DebugUtils — confronta un log generato realtime con un log di riferimento.
 *
 * Uso:
 *   const dbg = new DebugUtils();
 *   await dbg.loadReference('nestest.log');
 *   dbg.push("riga del log generato");
 */
class DebugUtils {
    constructor() {
      this.reference  = [];
      this.actual     = [];
      this.matchCount = 0;
      this.missCount  = 0;
  
      this._liveEl = document.getElementById('live-log');
      this._refEl  = document.getElementById('ref-log');
  
      this._bindScrollSync();
      document.getElementById('btn-reset').addEventListener('click', () => this.reset());
    }
  
    async loadReference(path) {
      this._setStatus('Loading…');
      try {
        const res  = await fetch(path);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        this.reference = text.split('\n')
          .map(l => l.replace(/\r$/, ''))
          .filter(l => l.trim() !== '');
        this._renderReference();
        this._setStatus(`Ready — ${this.reference.length} lines`);
      } catch (e) {
        this._setStatus(`⚠ ${e.message}`);
      }
    }
  
    push(line) {
      const i        = this.actual.length;
      const expected = this.reference[i] ?? null;
      const isMatch  = expected !== null && expected === line;
  
      this.actual.push(line);
      isMatch ? this.matchCount++ : this.missCount++;
  
      this._appendLive(i, line, isMatch, expected);
      this._updateRef(i, isMatch);
      this._updateStats();
  
      return { index: i, match: isMatch, expected };
    }
  
    reset() {
      this.actual     = [];
      this.matchCount = 0;
      this.missCount  = 0;
      this._liveEl.innerHTML = '';
      this._renderReference();
      this._updateStats();
    }
  
    // ── private ──────────────────────────────────────────────────────────────
  
    _renderReference() {
      this._refEl.innerHTML = '';
      this.reference.forEach((line, i) => {
        this._refEl.appendChild(this._makeRow(i, line, 'pending'));
      });
    }
  
    _appendLive(i, line, isMatch, expected) {
      const cls = expected === null ? 'mismatch' : isMatch ? 'match' : 'mismatch';
      const row = this._makeRow(i, line, cls);
      this._liveEl.appendChild(row);
      this._liveEl.scrollTop = this._liveEl.scrollHeight;
      this._syncScroll(this._liveEl);
    }
  
    _updateRef(i, isMatch) {
      const row = this._refEl.children[i];
      if (!row) return;
      row.className = 'log-row ' + (isMatch ? 'match' : 'mismatch');
  
      // Evidenzia la prossima riga attesa
      const next = this._refEl.children[i + 1];
      if (next) next.classList.add('active');
    }
  
    _makeRow(i, text, cls) {
      const row = document.createElement('div');
      row.className = `log-row ${cls}`;
      row.innerHTML = `<span class="row-num">${String(i + 1).padStart(4, ' ')}</span><span>${text}</span>`;
      return row;
    }
  
    _updateStats() {
      const total = this.actual.length;
      const ref   = this.reference.length;
      document.getElementById('st-prog').textContent = `${total} / ${ref}`;
      document.getElementById('st-ok').textContent   = `✓ ${this.matchCount}`;
      document.getElementById('st-err').textContent  = `✗ ${this.missCount}`;
      if (total > 0 && total === ref)
        this._setStatus(this.missCount === 0 ? '✓ All passed' : `✗ ${this.missCount} mismatch`);
    }
  
    _setStatus(msg) {
      document.getElementById('st-msg').textContent = msg;
    }
  
    _syncScroll(src) {
      const dst   = src === this._liveEl ? this._refEl : this._liveEl;
      dst.scrollTop = src.scrollTop;
    }
  
    _bindScrollSync() {
      let busy = false;
      const sync = (src) => () => {
        if (busy) return;
        busy = true;
        this._syncScroll(src);
        busy = false;
      };
      this._liveEl.addEventListener('scroll', sync(this._liveEl));
      this._refEl .addEventListener('scroll', sync(this._refEl));
    }
  }
  
  // Istanza globale accessibile da script.js
  const dbg = new DebugUtils();
  dbg.loadReference('nestest.log');