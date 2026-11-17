-- =============================================================
-- ESTUDIIO — Dados iniciais (seed)
-- Rode DEPOIS de 001_schema.sql.
-- Ajuste os valores dos planos conforme a tabela de preços real.
-- =============================================================

-- Espaços: 2 espaços + ala de massagem
insert into spaces (name, capacity) values
  ('Espaço 1', 4),
  ('Espaço 2', 8),
  ('Ala de Massagem', 1);

-- Modalidades (capacidades da reunião)
insert into class_types (name, max_students) values
  ('Solo', 1),
  ('Dupla', 2),
  ('Grupo', 4),
  ('Aparelho', 4),
  ('Pilates', 8),
  ('Yoga', 8),
  ('Hot', 8);

-- Planos: 1, 3 ou 6 meses — pagamento mensal
-- (valores de exemplo; editar na tela de Planos ou aqui)
insert into plans (name, duration_months, classes_per_week, monthly_price) values
  ('Mensal 1x/semana', 1, 1, 280.00),
  ('Mensal 2x/semana', 1, 2, 380.00),
  ('Trimestral 2x/semana', 3, 2, 350.00),
  ('Semestral 2x/semana', 6, 2, 320.00);

-- Despesas recorrentes típicas (editar valores reais)
insert into expenses (description, category, amount, recurring, due_day) values
  ('Aluguel do estúdio', 'aluguel', 0.00, true, 5),
  ('Internet', 'internet', 0.00, true, 10),
  ('Contabilidade', 'contabilidade', 0.00, true, 10),
  ('Energia elétrica', 'luz', 0.00, true, 15),
  ('Impostos (DAS)', 'impostos', 0.00, true, 20),
  ('Celular', 'celular', 0.00, true, 10);
