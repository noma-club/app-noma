import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { PASSWORD_HINT } from "@/lib/password";
import ConfirmButton from "@/components/ConfirmButton";
import {
  createUser,
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
    .select("id, name, role, active, username, created_at")
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
          Acesso por <b>usuário e senha</b> — sem e-mail. {PASSWORD_HINT}
        </p>
        <form action={createUser} className="grid grid-4">
          <div className="field">
            <label>Nome *</label>
            <input name="name" required />
          </div>
          <div className="field">
            <label>Usuário (login) *</label>
            <input name="username" required placeholder="ex.: marina" autoCapitalize="none" />
          </div>
          <div className="field">
            <label>Senha inicial *</label>
            <input name="password" type="text" required placeholder="Ex.: Noma@2026" />
          </div>
          <div className="field">
            <label>Papel</label>
            <select name="role" defaultValue="professor">
              <option value="professor">Professor</option>
              <option value="dono">Dono</option>
            </select>
          </div>
          <div className="field" style={{ alignSelf: "end" }}>
            <button type="submit" className="btn-block">Criar acesso</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Equipe</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Usuário</th>
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
                    {p.username
                      ? <code className="mono">{p.username}</code>
                      : <span className="muted">— sem login</span>}
                  </td>
                  <td>
                    <form action={setRole} className="inline">
                      <input type="hidden" name="id" value={p.id} />
                      <select name="role" defaultValue={p.role}>
                        <option value="professor">Professor</option>
                        <option value="dono">Dono</option>
                      </select>
                      <ConfirmButton
                        message={`Confirmar alteração de papel de ${p.name}? Isso muda as permissões de acesso.`}
                        className="btn-sm btn-outline"
                      >
                        Salvar
                      </ConfirmButton>
                    </form>
                  </td>
                  <td>
                    {p.active ? (
                      <span className="badge badge-ok">Ativo</span>
                    ) : (
                      <span className="badge badge-danger">Desativado</span>
                    )}
                  </td>
                  <td>
                    <div className="row gap-sm">
                      <form action={toggleActive}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="active" value={p.active ? "0" : "1"} />
                        {p.active ? (
                          <ConfirmButton
                            message={`Desativar ${p.name}? O login será bloqueado imediatamente.`}
                            className="btn-sm btn-danger"
                          >
                            Desativar
                          </ConfirmButton>
                        ) : (
                          <button type="submit" className="btn-sm">Reativar</button>
                        )}
                      </form>
                      <form action={resetPassword} className="inline">
                        <input type="hidden" name="id" value={p.id} />
                        <input
                          name="password"
                          type="text"
                          placeholder="Nova senha forte"
                          required
                          style={{ width: 150 }}
                          title="Mín. 8, com maiúscula, minúscula e caractere especial"
                        />
                        <button type="submit" className="btn-sm btn-outline">Redefinir</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted mt">
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
        <div className="table-wrap">
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
                    <code className="mono">/aluno/{c.access_token}</code>
                  </td>
                  <td>
                    <div className="row gap-sm">
                      <form action={rotateClientToken}>
                        <input type="hidden" name="id" value={c.id} />
                        <ConfirmButton
                          message={`Gerar um novo link para ${c.name}? O link atual deixará de funcionar.`}
                          className="btn-sm btn-outline"
                        >
                          Gerar novo link
                        </ConfirmButton>
                      </form>
                      <form action={deleteClientUser}>
                        <input type="hidden" name="id" value={c.id} />
                        <ConfirmButton
                          message={`Excluir ${c.name}? Inscrições, assinaturas e reposições serão removidas. Esta ação não pode ser desfeita.`}
                          className="btn-sm btn-danger"
                        >
                          Excluir aluno
                        </ConfirmButton>
                      </form>
                    </div>
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
      </div>
    </>
  );
}
