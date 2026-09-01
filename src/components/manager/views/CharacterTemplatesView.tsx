import { Trash2 } from 'lucide-react';
import { useCampaignStore } from '../../../state/campaignStore';

export function CharacterTemplatesView() {
  const { state, actions } = useCampaignStore();
  const templates = Object.values(state.entities.characterTemplates ?? {}).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section data-testid="character-templates-view" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-fg-bright">Character Templates</h2>
        <p className="text-sm text-fg-muted">Edit reusable character builds. Deleted built-ins remain deleted.</p>
      </div>
      {templates.length === 0 && <div className="rounded border border-edge p-6 text-fg-faint">No character templates saved.</div>}
      <div className="grid gap-3 lg:grid-cols-2">
        {templates.map((template) => (
          <article key={template.id} className="rounded-lg border border-edge bg-surface-1/70 p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <input aria-label={`${template.name} template name`} defaultValue={template.name} onBlur={(event) => {
                    const name = event.target.value.trim();
                    if (name && name !== template.name) actions.upsertCharacterTemplate({ ...template, name, updatedAt: Date.now() });
                  }} className="min-w-0 flex-1 rounded border border-edge-strong bg-surface-0 px-2 py-1 font-medium text-fg-bright" />
                  <span className="whitespace-nowrap text-sm text-warning-300">{template.gcsData.totalPoints} pts</span>
                  {template.builtin && <span className="rounded bg-accent-500/15 px-2 py-0.5 text-xs text-accent-300">Built-in</span>}
                </div>
                <textarea aria-label={`${template.name} template description`} defaultValue={template.description} onBlur={(event) => {
                  const description = event.target.value.trim();
                  if (description !== template.description) actions.upsertCharacterTemplate({ ...template, description, updatedAt: Date.now() });
                }} rows={2} className="w-full rounded border border-edge-strong bg-surface-0 px-2 py-1 text-sm text-fg-secondary" />
              </div>
              <button type="button" aria-label={`Delete ${template.name}`} onClick={() => {
                if (window.confirm(`Delete character template “${template.name}”?`)) actions.removeCharacterTemplate(template.id);
              }} className="rounded p-2 text-danger-400 hover:bg-danger-500/10"><Trash2 className="h-4 w-4" /></button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
