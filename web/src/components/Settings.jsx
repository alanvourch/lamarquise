import { Sheet } from './ui.jsx';

export function SettingsSheet({ open, onClose, settings, setSettings, onPickCinemas, onReset }) {
  const set = (patch) => setSettings((s) => ({ ...s, ...patch }));
  return (
    <Sheet open={open} onClose={onClose} label="Réglages">
      <div className="settings">
        <h2>Réglages</h2>

        <label className="setting">
          <span>
            <strong>Abonné CinéPlus</strong>
            <small>Affiche le prix membre sur les séances Cineplex : 11 $, 16 $ en UltraAVX.</small>
          </span>
          <input type="checkbox" checked={settings.cineplus} onChange={(e) => set({ cineplus: e.target.checked })} />
        </label>

        <label className="setting">
          <span>
            <strong>Masquer les séances passées</strong>
            <small>Les séances commencées depuis plus de 15 min disparaissent.</small>
          </span>
          <input type="checkbox" checked={settings.hidePast} onChange={(e) => set({ hidePast: e.target.checked })} />
        </label>

        <button className="btn btn--block" onClick={onPickCinemas}>
          Choisir mes cinémas favoris
        </button>
        <button className="btn btn--ghost btn--block" onClick={onReset}>
          Réinitialiser les filtres
        </button>
        <p className="muted small">Favoris et réglages sont enregistrés dans ce navigateur.</p>
      </div>
    </Sheet>
  );
}
