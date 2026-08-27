export function newMindFields(): string {
  return `<label>Slug <input name="slug" required></label>
<label>Name <input name="name" required></label>
<label>Persona <textarea name="persona" required></textarea></label>
<label>Core <textarea name="core" required></textarea></label>`;
}

export function newMindForm(): string {
  return `<form method="post" action="/op/new">
${newMindFields()}
<button>Create</button>
</form>`;
}
