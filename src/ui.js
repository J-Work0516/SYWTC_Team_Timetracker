export const $ = (id) => document.getElementById(id);
export function el(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}
export function field(parent, title, control) {
  const label = el("label", title);
  label.append(control);
  parent.append(label);
  return control;
}
export function choices(select, values, placeholder) {
  select.replaceChildren();
  if (placeholder) select.add(new Option(placeholder, ""));
  for (const value of values) select.add(new Option(value, value));
  return select;
}
export function table(parent, headers, rows) {
  if (!rows.length) {
    parent.append(el("p", "No entries for this selection."));
    return;
  }
  const wrap = el("div"),
    grid = el("table"),
    header = grid.createTHead().insertRow();
  wrap.className = "table";
  for (const label of headers) header.append(el("th", label));
  const body = grid.createTBody();
  for (const row of rows) {
    const tr = body.insertRow();
    row.forEach((value) =>
      tr
        .insertCell()
        .append(value instanceof Node ? value : String(value ?? "")),
    );
  }
  wrap.append(grid);
  parent.append(wrap);
}
export function action(button, callback) {
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    if (button.disabled) return;
    button.disabled = true;
    try {
      await callback();
    } catch (error) {
      $("status").textContent = error.message;
      $("status").scrollIntoView({ block: "nearest" });
    } finally {
      button.disabled = false;
    }
  });
}
export async function all(entity, where) {
  const result = [];
  for (let skip = 0; ; skip += 100) {
    const page = where
      ? await entity.filter(where, "id", 100, skip)
      : await entity.list("id", 100, skip);
    result.push(...page);
    if (page.length < 100) return result;
  }
}
