import type { CharacterDiff, CollectionDiff } from '../../utils/characterDiff';

interface NamedEntry {
  name: string;
}

interface CharacterDiffPreviewProps {
  diff: CharacterDiff;
}

function CollectionChanges<T extends NamedEntry>({
  title,
  collection,
}: {
  title: string;
  collection: CollectionDiff<T>;
}) {
  if (collection.added.length + collection.removed.length + collection.changed.length === 0) return null;

  return (
    <div className="space-y-1">
      <h5 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{title}</h5>
      {collection.added.map((entry, index) => (
        <div key={`added-${entry.name}-${index}`} className="text-sm text-emerald-300">
          + {entry.name}
        </div>
      ))}
      {collection.removed.map((entry, index) => (
        <div key={`removed-${entry.name}-${index}`} className="text-sm text-danger-300">
          − {entry.name}
        </div>
      ))}
      {collection.changed.map((entry) => (
        <div key={`changed-${entry.name}`} className="text-sm text-fg-primary">
          <div className="font-medium">{entry.name}</div>
          {entry.changes.map((change) => (
            <div key={change.path} className="pl-3 text-xs text-fg-muted">
              {change.label}: <span className="text-danger-300">{change.from}</span>
              {' → '}
              <span className="text-emerald-300">{change.to}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function CharacterDiffPreview({ diff }: CharacterDiffPreviewProps) {
  const totalChanges = Object.values(diff.summary).reduce((total, count) => total + count, 0);
  const attributeChanges = diff.scalarChanges.filter((change) =>
    change.path === 'name'
    || change.path.includes('.attributes.')
    || change.path.includes('.attributePoints.')
    || change.path.includes('.secondaryAttributes.')
  );
  const poolChanges = diff.scalarChanges.filter((change) =>
    change.path.includes('.pools.') || change.path.endsWith('.totalPoints')
  );
  const traitCollections = [diff.advantages, diff.perks, diff.disadvantages, diff.quirks];
  const hasTraitChanges = traitCollections.some(
    (collection) => collection.added.length + collection.removed.length + collection.changed.length > 0
  );

  return (
    <div className="space-y-4" aria-label="Character changes">
      <div className="text-sm font-medium text-indigo-200">
        {totalChanges} {totalChanges === 1 ? 'change' : 'changes'}
      </div>

      {totalChanges === 0 && <p className="text-sm text-fg-muted">No import-visible changes.</p>}

      {attributeChanges.length > 0 && (
        <section>
          <h4 className="mb-1 font-semibold text-fg-bright">Attributes</h4>
          {attributeChanges.map((change) => (
            <div key={change.path} className="text-sm text-fg-secondary">
              {change.label}: <span className="text-danger-300">{change.from}</span>
              {' → '}
              <span className="text-emerald-300">{change.to}</span>
            </div>
          ))}
        </section>
      )}

      {poolChanges.length > 0 && (
        <section>
          <h4 className="mb-1 font-semibold text-fg-bright">Pools</h4>
          {poolChanges.map((change) => (
            <div key={change.path} className="text-sm text-fg-secondary">
              {change.label}: <span className="text-danger-300">{change.from}</span>
              {' → '}
              <span className="text-emerald-300">{change.to}</span>
            </div>
          ))}
        </section>
      )}

      <section>
        <h4 className="mb-1 font-semibold text-fg-bright">Skills</h4>
        <CollectionChanges title="Skills" collection={diff.skills} />
      </section>
      <section>
        <h4 className="mb-1 font-semibold text-fg-bright">Spells</h4>
        <CollectionChanges title="Spells" collection={diff.spells} />
      </section>
      {hasTraitChanges && (
        <section className="space-y-2">
          <h4 className="font-semibold text-fg-bright">Traits</h4>
          <CollectionChanges title="Advantages" collection={diff.advantages} />
          <CollectionChanges title="Perks" collection={diff.perks} />
          <CollectionChanges title="Disadvantages" collection={diff.disadvantages} />
          <CollectionChanges title="Quirks" collection={diff.quirks} />
        </section>
      )}
      <section>
        <h4 className="mb-1 font-semibold text-fg-bright">Equipment</h4>
        <CollectionChanges title="Equipment" collection={diff.equipment} />
      </section>
    </div>
  );
}
