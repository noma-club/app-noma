import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import {
  createTeacher,
  setRole,
  toggleActive,
  resetPassword,
  deleteClientUser,
  rotateClientToken,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const me = await requireOwner();
  const { ok, erro } = await searchParams;

  const { data: team } = await db()
    .from("profiles")
    .select("id, name, role, active, created_at")
    .order("role")
    .order("name");

  const { data: clients } = await db()
    .from("clients")
    .select("id, name, phone, status, access_token")
    .order("name");

  return (
    <>
      {ok && <div className="msg msg-ok">{ok}</div>}
      {erro && <div className="msg msg-err">{erro}</div>}

      {/* ---------- Equipe (donos e professores) ---------- */}
      <div className="card">
        <h2>Novo professor / dono</h2>
        <p className="muted">
          Cria o acesso de login no app. A senha pode ser trocada depois pelo próprio dono.
        </p>
        <form action={createTeacher} className="grid grid-3">
          <div className="field">
            <label>Nome *</label>
            <input name="name" required />
          </div>
          <div className="field">
            <label>E-mail (login) *</label>
            <input name="email" type="email" required />
          </div>
          <div className="field">
            <label>Senha inicial * (mín. 6)</label>
            <input name="password" type="text" minLength={6} required />
          </div>
          <div className="field">
            <label>Papel</label>
            <select name="role" defaultValue="professor">
              <option value="professor">Professor</option>
              <option value="dono">Dono</option>
            </select>
          </div>
          <div className="field" style={{ alignSelf: "end" }}>
            <button>Criar acesso</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Equipe</h2>
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Papel</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {team?.map((p: any) => (
              <tr key={p.id}>
                <td>
                  {p.name}
                  {p.id === me.id && <span className="muted"> (você)</span>}
                </td>
                <td>
                  <form action={setRole} className="inline">
                    <input type="hidden" name="id" value={p.id} />
                    <select name="role" defaultValue={p.role}>
                      <option value="professor">Professor</option>
                      <option value="dono">Dono</option>
                    </select>
                    <button className="btn-sm btn-outline">Salvar</button>
                  </form>
                </td>
                <td>
                  {p.active ? (
                    <span className="badge badge-fixo">Ativo</span>
                  ) : (
                    <span className="badge badge-danger">Desativado</span>
                  )}
                </td>
                <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <form action={toggleActive}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="active" value={p.active ? "0" : "1"} />
                    <button className={p.active ? "btn-sm btn-danger" : "btn-sm"}>
                      {p.active ? "Desativar" : "Reativar"}
                    </button>
                  </form>
                  <form action={resetPassword} className="inline">
                    <input type="hidden" name="id" value={p.id} />
                    <input
                      name="password"
                      type="text"
                      placeholder="Nova senha"
                      minLength={6}
                      required
                      style={{ width: 120 }}
                    />
                    <button className="btn-sm btn-outline">Redefinir</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">
          Desativar bloqueia o login imediatamente, mas preserva o histórico de aulas do professor.
        </p>
      </div>

      {/* ---------- Alunos (acesso por link) ---------- */}
      <div className="card">
        <h2>Alunos — acesso por link</h2>
        <p className="muted">
          O cadastro de alunos é feito na aba <a href="/admin/clientes">Clientes</a>. Aqui o dono
          gerencia o <b>acesso</b>: gerar novo link (invalida o antigo) ou excluir o aluno do
          sistema.
        </p>
        <table>
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Link de acesso</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {clients?.map((c: any) => (
              <tr key={c.id}>
                <td>
                  {c.name} <span className={`badge badge-${c.status}`}>{c.status}</span>
                </td>
                <td>
                  <code style={{ fontSize: 12 }}>/aluno/{c.access_token}</code>
                </td>
                <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <form action={rotateClientToken}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="btn-sm btn-outline">Gerar novo link</button>
                  </form>
                  <form action={deleteClientUser}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="btn-sm btn-danger">Excluir aluno</button>
                  </form>
                </td>
              </tr>
            ))}
            {!clients?.length && (
              <tr>
                <td colSpan={3} className="muted">Nenhum aluno cadastrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
