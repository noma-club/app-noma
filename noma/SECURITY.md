# Segurança — Noma Club

Mapeamento contra o **OWASP Top 10 (2021)** e rotina de manutenção.

## OWASP Top 10 × o que o sistema faz

| # | Risco | Medida implementada |
| --- | --- | --- |
| A01 | Broken Access Control | Todo acesso a dados passa pelo servidor. `requireUser()` em todas as telas admin; `requireOwner()` nas telas exclusivas de dono (Usuários). Professor só enxerga as próprias aulas (filtro por `teacher_id` no servidor). Área do aluno validada por token de 128 bits no servidor. RLS ativo em todas as tabelas **sem policies públicas** — o banco recusa acesso direto do navegador. |
| A02 | Cryptographic Failures | `SUPABASE_SERVICE_ROLE_KEY` só existe no servidor (nunca no bundle do cliente). Senhas com hash **bcrypt** (pgcrypto `crypt`/`gen_salt('bf')`), verificadas no banco. Sessão = cookie `httpOnly`, `sameSite=lax`, `secure` em produção, **assinado com HMAC-SHA256** (`SESSION_SECRET`) e validado localmente, expira em 8h. HSTS força HTTPS. |
| A03 | Injection | Nenhum SQL concatenado — todas as queries via supabase-js (parametrizadas). Única função SQL (`rotate_client_token`) recebe UUID tipado. React escapa saída por padrão (XSS). |
| A04 | Insecure Design | Regras de negócio (6h, reposições, lista de espera, capacidade) validadas **no servidor**, nunca só na interface. Mensagem de login genérica (não revela se o e-mail existe). |
| A05 | Security Misconfiguration | Headers em `next.config.mjs`: **CSP**, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` (o link do aluno carrega token na URL — não pode vazar via referer), HSTS, `Permissions-Policy`, `poweredByHeader: false`. |
| A06 | Vulnerable Components | Poucas dependências (next, react, supabase-js). Rotina: `npm audit` mensal + Dependabot no GitHub (ver abaixo). |
| A07 | Auth Failures (brute force) | **Lockout persistido no banco** (`login_attempts`): 5 falhas por e-mail ou 20 por IP em 15 min bloqueiam por 15 min. Sucesso zera o contador. Funciona em serverless (estado no banco, não em memória). |
| A08 | Software/Data Integrity | Deploy só a partir do repositório GitHub (sem upload manual). Server Actions do Next validam origem da requisição (proteção CSRF embutida) + `form-action 'self'` na CSP. |
| A09 | Logging & Monitoring | Tabela `login_attempts` registra falhas de login (e-mail + IP + horário). Logs de requisição na plataforma de hosting e no painel do Supabase. |
| A10 | SSRF | O servidor não faz requisições a URLs fornecidas por usuários. |

## CSP (Content-Security-Policy)

Definida em `next.config.mjs`. Libera apenas o próprio domínio + Google Fonts (tipografia da marca).
`script-src` inclui `'unsafe-inline'` porque o Next.js injeta scripts inline de hidratação;
**próximo nível de hardening**: CSP com *nonce* via middleware
([guia oficial do Next](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy)).

## Brute force — como funciona

```
login → isLockedOut(email, ip)?  → bloqueado: erro "tente em 15 min"
      → senha errada             → grava falha (email + ip)
      → senha certa              → apaga falhas do e-mail, cria sessão 8h
```

Ajustes em `src/lib/ratelimit.ts` (`MAX_PER_EMAIL`, `MAX_PER_IP`, `WINDOW_MIN`).
Limpeza da tabela (opcional, agendar no Supabase com pg_cron):

```sql
delete from login_attempts where created_at < now() - interval '1 day';
```

## Checklist de manutenção ("segurança em dia")

**No primeiro deploy**
- [ ] Rodar as 3 migrations (001, 002, 003) + seed
- [ ] No Supabase: Authentication → Policies → senha mínima **8+ caracteres**
- [ ] Conferir que `.env*` não foi commitado (está no `.gitignore`)
- [ ] Testar os headers em <https://securityheaders.com> após o deploy

**Mensal**
- [ ] `npm audit` e `npm update` (ou aceitar PRs do Dependabot)
- [ ] Olhar `login_attempts` por padrões de ataque (muitos IPs diferentes)

**No GitHub (uma vez)**
- [ ] Ativar **Dependabot alerts + security updates** (Settings → Code security)
- [ ] Ativar **Secret scanning**

**Quando um professor sair**
- [ ] Desativar na aba Usuários (bloqueia login na hora, preserva histórico)

**Se um link de aluno vazar**
- [ ] Aba Usuários → "Gerar novo link" (invalida o anterior imediatamente)
