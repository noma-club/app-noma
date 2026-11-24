import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import ActionForm from "@/components/ActionForm";
import {
  createClassType,
  updateClassType,
  toggleClassType,
  createSpace,
  updateSpace,
  toggleSpace,
  createIncomeCategory,
  toggleIncomeCategory,
  createExpenseCategory,
  toggleExpenseCategory,
} from "./actions";

export const dynamic = "force-dynamic";

type Row = { id: string; name: string; active: boolean };
type TypeRow = Row & { max_students: number };
type SpaceRow = Row & { capacity: number };

export default async function CadastrosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  await requireOwner();
  const { ok, erro } = await searchParams;

  const [{ data: types }, { data: spaces }, { data: incomeCats }, { data: expenseCats }] =
    await Promise.all([
      db().from("class_types").select("id, name, max_students, active").order("name"),
      db().from("spaces").select("id, name, capacity, active").order("name"),
      db().from("income_categories").select("id, name, active").order("name"),
      db().from("expense_categories").select("id, name, active").order("name"),
    ]);

  return (
    <>
      {ok && <div className="msg msg-ok">{ok}</div>}
      {erro && <div className="msg msg-err">{erro}</div>}

      <p className="muted">
        Modalidades, salas e categorias usadas na agenda e no financeiro.
        As alterações aparecem na hora, sem recarregar a página.
      </p>

      <div className="grid grid-2 mt">
        {/* ================= Modalidades ================= */}
        <section className="card">
          <h2>Modalidades</h2>
          <p className="muted">Tipos de aula oferecidos (ex.: Pilates Solo, Studio).</p>

          <ActionForm action={createClassType} className="row mt">
            <div className="field grow-1">
              <label>Nome da modalidade</label>
              <input name="name" required placeholder="Ex.: Pilates Studio" />
            </div>
            <div className="field w-num">
              <label>Máx. alunos</label>
              <input name="max_students" type="number" min={1} defaultValue={6} required />
            </div>
            <button type="submit" className="btn-sm">Adicionar</button>
          </ActionForm>

          <div className="table-wrap mt">
            <table>
              <thead>
                <tr>
                  <th>Modalidade</th>
                  <th className="num">Máx.</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(types ?? []).map((t: TypeRow) => (
                  <tr key={t.id} className={t.active ? undefined : "is-off"}>
                    <td colSpan={2}>
                      <ActionForm action={updateClassType} className="row gap-sm" reset={false}>
                        <input type="hidden" name="id" value={t.id} />
                        <input name="name" defaultValue={t.name} required aria-label="Nome" />
                        <input
                          name="max_students"
                          type="number"
                          min={1}
                          defaultValue={t.max_students}
                          required
                          aria-label="Máximo de alunos"
                          className="inp-num"
                        />
                        <button type="submit" className="btn-sm btn-outline">Salvar</button>
                      </ActionForm>
                    </td>
                    <td className="num">
                      <ActionForm action={toggleClassType} reset={false}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="active" value={t.active ? "0" : "1"} />
                        <button type="submit" className="btn-sm btn-ghost">
                          {t.active ? "Desativar" : "Reativar"}
                        </button>
                      </ActionForm>
                    </td>
                  </tr>
                ))}
                {(types ?? []).length === 0 && (
                  <tr><td colSpan={3} className="muted">Nenhuma modalidade cadastrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ================= Salas ================= */}
        <section className="card">
          <h2>Salas</h2>
          <p className="muted">Espaços onde as aulas acontecem e sua lotação.</p>

          <ActionForm action={createSpace} className="row mt">
            <div className="field grow-1">
              <label>Nome da sala</label>
              <input name="name" required placeholder="Ex.: Sala 1" />
            </div>
            <div className="field w-num">
              <label>Capacidade</label>
              <input name="capacity" type="number" min={1} defaultValue={6} required />
            </div>
            <button type="submit" className="btn-sm">Adicionar</button>
          </ActionForm>

          <div className="table-wrap mt">
            <table>
              <thead>
                <tr>
                  <th>Sala</th>
                  <th className="num">Cap.</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(spaces ?? []).map((s: SpaceRow) => (
                  <tr key={s.id} className={s.active ? undefined : "is-off"}>
                    <td colSpan={2}>
                      <ActionForm action={updateSpace} className="row gap-sm" reset={false}>
                        <input type="hidden" name="id" value={s.id} />
                        <input name="name" defaultValue={s.name} required aria-label="Nome" />
                        <input
                          name="capacity"
                          type="number"
                          min={1}
                          defaultValue={s.capacity}
                          required
                          aria-label="Capacidade"
                          className="inp-num"
                        />
                        <button type="submit" className="btn-sm btn-outline">Salvar</button>
                      </ActionForm>
                    </td>
                    <td className="num">
                      <ActionForm action={toggleSpace} reset={false}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="active" value={s.active ? "0" : "1"} />
                        <button type="submit" className="btn-sm btn-ghost">
                          {s.active ? "Desativar" : "Reativar"}
                        </button>
                      </ActionForm>
                    </td>
                  </tr>
                ))}
                {(spaces ?? []).length === 0 && (
                  <tr><td colSpan={3} className="muted">Nenhuma sala cadastrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="grid grid-2 mt">
        <CategoryBlock
          title="Categorias de recebimento"
          hint="Usadas ao lançar entradas no financeiro (ex.: mensalidade, avulsa)."
          placeholder="Ex.: mensalidade"
          rows={(incomeCats ?? []) as Row[]}
          onCreate={createIncomeCategory}
          onToggle={toggleIncomeCategory}
        />
        <CategoryBlock
          title="Categorias de despesa"
          hint="Usadas ao lançar saídas no financeiro (ex.: aluguel, energia)."
          placeholder="Ex.: aluguel"
          rows={(expenseCats ?? []) as Row[]}
          onCreate={createExpenseCategory}
          onToggle={toggleExpenseCategory}
        />
      </div>
    </>
  );
}

function CategoryBlock({
  title,
  hint,
  placeholder,
  rows,
  onCreate,
  onToggle,
}: {
  title: string;
  hint: string;
  placeholder: string;
  rows: Row[];
  onCreate: (fd: FormData) => Promise<void>;
  onToggle: (fd: FormData) => Promise<void>;
}) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <p className="muted">{hint}</p>

      <ActionForm action={onCreate} className="row mt">
        <div className="field grow-1">
          <label>Nome da categoria</label>
          <input name="name" required placeholder={placeholder} />
        </div>
        <button type="submit" className="btn-sm">Adicionar</button>
      </ActionForm>

      <div className="chips mt">
        {rows.map((c) => (
          <span key={c.id} className={c.active ? "chip" : "chip is-off"}>
            {c.name}
            <ActionForm action={onToggle} reset={false}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="active" value={c.active ? "0" : "1"} />
              <button type="submit" title={c.active ? "Desativar" : "Reativar"}>
                {c.active ? "×" : "+"}
              </button>
            </ActionForm>
          </span>
        ))}
        {rows.length === 0 && <span className="muted">Nenhuma categoria cadastrada.</span>}
      </div>
    </section>
  );
}
