/**
 * A small in-memory stand-in for the Prisma client, used by the tenant-
 * isolation and permission suites.
 *
 * WHY THIS EXISTS RATHER THAN A REAL DATABASE
 * This app runs on Postgres (Supabase). There is no local Postgres and no
 * Docker on the supported dev setup, and Prisma 7 has no PGlite adapter, so
 * an in-process real Postgres isn't available either. Pointing tests at the
 * shared dev/production Supabase instance is not an option — tests must
 * never touch real data. So the database is replaced.
 *
 * WHY THIS IS NOT A VACUOUS MOCK
 * The important distinction: this does NOT stub out "what the action should
 * return". It stores rows and genuinely evaluates the `where` clause the
 * application code passes — including `companyId` and nested relation
 * filters like `{ lead: { companyId } }`.
 *
 * That means the security property is tested as behaviour, not as shape.
 * Seed a lead into Company B, act as a Company A user, and:
 *   - with `findFirst({ where: { id, companyId } })` the row is not found,
 *     the action throws ForbiddenError, and the test passes;
 *   - drop `companyId` from that where clause (or switch to `findUnique`)
 *     and this store faithfully returns Company B's row, the action proceeds
 *     to mutate it, and the test fails.
 *
 * So a regression in the scoping of a query is caught here, which is exactly
 * the safety net this wave is for. What it deliberately does NOT cover is
 * anything below the query builder: real SQL generation, constraints,
 * cascades, or transaction semantics. Those gaps are stated in the wave
 * report rather than papered over.
 *
 * Only the query surface the code under test actually uses is implemented.
 * It is meant to stay small; if a test needs a query shape that isn't here,
 * add that shape rather than reaching for a broader fake.
 */

export type Row = Record<string, unknown>;

type RelationDef = { model: string; from: string };

/**
 * Relation metadata for the nested `where`/`include` shapes the code under
 * test uses (e.g. `task.findFirst({ where: { id, lead: { companyId } } })`).
 * Only belongs-to edges are modelled — that is all the security-relevant
 * queries traverse.
 */
const RELATIONS: Record<string, Record<string, RelationDef>> = {
  session: { user: { model: "user", from: "userId" } },
  user: { company: { model: "company", from: "companyId" } },
  lead: {
    company: { model: "company", from: "companyId" },
    customer: { model: "customer", from: "customerId" },
    owner: { model: "user", from: "ownerId" },
  },
  task: {
    lead: { model: "lead", from: "leadId" },
    assignedTo: { model: "user", from: "assignedToId" },
  },
  activity: {
    lead: { model: "lead", from: "leadId" },
    user: { model: "user", from: "userId" },
  },
  quotation: {
    lead: { model: "lead", from: "leadId" },
    company: { model: "company", from: "companyId" },
  },
  customer: { company: { model: "company", from: "companyId" } },
  product: { company: { model: "company", from: "companyId" } },
  notification: { company: { model: "company", from: "companyId" } },
  quotationItem: { product: { model: "product", from: "productId" } },
};

/** Has-many edges, keyed by the child's foreign key back to the parent. */
const HAS_MANY: Record<string, Record<string, { model: string; fk: string }>> = {
  company: { users: { model: "user", fk: "companyId" }, leads: { model: "lead", fk: "companyId" } },
  user: { sessions: { model: "session", fk: "userId" }, assignedLeads: { model: "lead", fk: "ownerId" }, tasks: { model: "task", fk: "assignedToId" } },
  customer: { leads: { model: "lead", fk: "customerId" } },
  lead: {
    quotations: { model: "quotation", fk: "leadId" },
    tasks: { model: "task", fk: "leadId" },
    activities: { model: "activity", fk: "leadId" },
  },
  quotation: { items: { model: "quotationItem", fk: "quotationId" } },
};

/** Nested `create` writes used by the code under test (quotation line items). */
const NESTED_CREATE: Record<string, Record<string, { model: string; fk: string }>> = {
  quotation: { items: { model: "quotationItem", fk: "quotationId" } },
};

/** Column defaults the assertions actually depend on. */
const DEFAULTS: Record<string, Row> = {
  task: { status: "PENDING", completedAt: null },
  lead: { status: "NEW", priority: "MEDIUM" },
  user: { isActive: true, role: "SALESPERSON" },
  quotation: { status: "DRAFT" },
};

function isPlainObject(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Date && typeof b === "string") return a.toISOString() === b;
  return a === b;
}

function compare(a: unknown, b: unknown): number {
  const av = a instanceof Date ? a.getTime() : a;
  const bv = b instanceof Date ? b.getTime() : b;
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  if (typeof av === "string" && typeof bv === "string") return av < bv ? -1 : av > bv ? 1 : 0;
  return 0;
}

export class FakeDb {
  private readonly tables = new Map<string, Row[]>();
  private idCounter = 0;

  /** Deterministic ids keep failure output stable and readable. */
  private nextId(model: string): string {
    this.idCounter += 1;
    return `${model}_${this.idCounter}`;
  }

  reset(): void {
    this.tables.clear();
    this.idCounter = 0;
  }

  private table(model: string): Row[] {
    let rows = this.tables.get(model);
    if (!rows) {
      rows = [];
      this.tables.set(model, rows);
    }
    return rows;
  }

  /** Insert rows directly, bypassing the query layer — for fixtures. */
  seed(model: string, rows: Row[]): void {
    this.table(model).push(...rows.map((r) => ({ ...r })));
  }

  /** Read a table directly, for asserting on what a mutation actually wrote. */
  all(model: string): Row[] {
    return this.table(model).map((r) => ({ ...r }));
  }

  private matchesWhere(model: string, row: Row, where: unknown): boolean {
    if (!isPlainObject(where)) return true;

    return Object.entries(where).every(([key, condition]) => {
      if (condition === undefined) return true;

      if (key === "AND") {
        const clauses = Array.isArray(condition) ? condition : [condition];
        return clauses.every((c) => this.matchesWhere(model, row, c));
      }
      if (key === "OR") {
        const clauses = Array.isArray(condition) ? condition : [condition];
        return clauses.some((c) => this.matchesWhere(model, row, c));
      }
      if (key === "NOT") {
        return !this.matchesWhere(model, row, condition);
      }

      const relation = RELATIONS[model]?.[key];
      if (relation) {
        const foreignKey = row[relation.from];
        if (foreignKey == null) return false;
        const target = this.table(relation.model).find((r) => r.id === foreignKey);
        return target ? this.matchesWhere(relation.model, target, condition) : false;
      }

      // Prisma compound-unique selector — the key is the joined column names
      // rather than a real column, e.g.
      // `{ companyId_type_entityType_entityId_userId: { companyId, type, ... } }`.
      // Every field inside it has to match, which is just a nested where.
      if (!(key in row) && key.includes("_") && isPlainObject(condition)) {
        return this.matchesWhere(model, row, condition);
      }

      return this.matchesValue(row[key], condition);
    });
  }

  private matchesValue(value: unknown, condition: unknown): boolean {
    if (isPlainObject(condition)) {
      return Object.entries(condition).every(([operator, operand]) => {
        switch (operator) {
          case "equals":
            return valuesEqual(value, operand);
          case "not":
            return isPlainObject(operand) ? !this.matchesValue(value, operand) : !valuesEqual(value, operand);
          case "in":
            return Array.isArray(operand) && operand.some((o) => valuesEqual(value, o));
          case "notIn":
            return Array.isArray(operand) && !operand.some((o) => valuesEqual(value, o));
          case "gt":
            return compare(value, operand) > 0;
          case "gte":
            return compare(value, operand) >= 0;
          case "lt":
            return compare(value, operand) < 0;
          case "lte":
            return compare(value, operand) <= 0;
          case "contains":
            return typeof value === "string" && typeof operand === "string" && value.toLowerCase().includes(operand.toLowerCase());
          default:
            throw new Error(`fakeDb: unsupported filter operator "${operator}" — add it deliberately.`);
        }
      });
    }
    return valuesEqual(value, condition);
  }

  /** Projects a row down to a `select` clause, resolving nested relations. */
  private applySelect(model: string, row: Row, select: Row): Row {
    const result: Row = {};
    for (const [key, value] of Object.entries(select)) {
      if (!value) continue;
      if (RELATIONS[model]?.[key] || HAS_MANY[model]?.[key]) {
        result[key] = this.resolveRelation(model, row, key, isPlainObject(value) ? value : {});
      } else {
        result[key] = row[key];
      }
    }
    return result;
  }

  /** Resolves one relation edge (either direction) with nested include/select/orderBy/where/take. */
  private resolveRelation(model: string, row: Row, key: string, options: Row): unknown {
    const belongsTo = RELATIONS[model]?.[key];
    if (belongsTo) {
      const foreignKey = row[belongsTo.from];
      const target = foreignKey == null ? undefined : this.table(belongsTo.model).find((r) => r.id === foreignKey);
      if (!target) return null;
      if (isPlainObject(options.select)) return this.applySelect(belongsTo.model, target, options.select);
      return this.applyInclude(belongsTo.model, target, options.include);
    }

    const hasMany = HAS_MANY[model]?.[key];
    if (!hasMany) throw new Error(`fakeDb: unknown relation "${model}.${key}" — add it to the relation map.`);

    let children = this.table(hasMany.model).filter((child) => child[hasMany.fk] === row.id);
    if (options.where) children = children.filter((child) => this.matchesWhere(hasMany.model, child, options.where));
    children = this.sort(children, options.orderBy);
    if (typeof options.take === "number") children = children.slice(0, options.take);

    return children.map((child) =>
      isPlainObject(options.select) ? this.applySelect(hasMany.model, child, options.select) : this.applyInclude(hasMany.model, child, options.include)
    );
  }

  private applyInclude(model: string, row: Row, include: unknown): Row {
    if (!isPlainObject(include)) return { ...row };
    const result: Row = { ...row };

    for (const [key, value] of Object.entries(include)) {
      if (!value) continue;
      result[key] = this.resolveRelation(model, row, key, isPlainObject(value) ? value : {});
    }

    return result;
  }

  private sort(rows: Row[], orderBy: unknown): Row[] {
    if (!isPlainObject(orderBy)) return rows;
    const [field, direction] = Object.entries(orderBy)[0] ?? [];
    if (!field) return rows;
    return [...rows].sort((a, b) => {
      const result = compare(a[field], b[field]);
      return direction === "desc" ? -result : result;
    });
  }

  private find(model: string, args: Row): Row[] {
    const matched = this.table(model).filter((row) => this.matchesWhere(model, row, args.where));
    const ordered = this.sort(matched, args.orderBy);
    const limited = typeof args.take === "number" ? ordered.slice(0, args.take) : ordered;
    return limited.map((row) =>
      isPlainObject(args.select) ? this.applySelect(model, row, args.select) : this.applyInclude(model, row, args.include)
    );
  }

  /**
   * The Prisma-shaped surface handed to the application code. Every model is
   * served by the same generic delegate, so adding a model to a test needs no
   * change here.
   */
  client(): Record<string, unknown> {
    const delegate = (model: string) => ({
      findFirst: async (args: Row = {}) => this.find(model, args)[0] ?? null,
      findUnique: async (args: Row = {}) => this.find(model, args)[0] ?? null,
      findMany: async (args: Row = {}) => this.find(model, args),
      findFirstOrThrow: async (args: Row = {}) => {
        const row = this.find(model, args)[0];
        if (!row) throw new Error(`fakeDb: no ${model} found.`);
        return row;
      },
      findUniqueOrThrow: async (args: Row = {}) => {
        const row = this.find(model, args)[0];
        if (!row) throw new Error(`fakeDb: no ${model} found.`);
        return row;
      },
      count: async (args: Row = {}) => this.table(model).filter((row) => this.matchesWhere(model, row, args.where)).length,

      create: async (args: Row = {}) => {
        const data = isPlainObject(args.data) ? args.data : {};
        const now = new Date();
        const row: Row = { ...DEFAULTS[model], id: this.nextId(model), createdAt: now, updatedAt: now };

        for (const [key, value] of Object.entries(data)) {
          const nested = NESTED_CREATE[model]?.[key];
          if (nested && isPlainObject(value) && value.create) {
            continue; // handled after the parent row has an id
          }
          row[key] = value;
        }
        this.table(model).push(row);

        for (const [key, value] of Object.entries(data)) {
          const nested = NESTED_CREATE[model]?.[key];
          if (!nested || !isPlainObject(value) || !value.create) continue;
          const children = Array.isArray(value.create) ? value.create : [value.create];
          for (const child of children) {
            this.table(nested.model).push({
              ...(child as Row),
              id: this.nextId(nested.model),
              [nested.fk]: row.id,
            });
          }
        }

        return { ...row };
      },

      update: async (args: Row = {}) => {
        const row = this.table(model).find((r) => this.matchesWhere(model, r, args.where));
        if (!row) throw new Error(`fakeDb: ${model} to update not found.`);
        Object.assign(row, isPlainObject(args.data) ? args.data : {}, { updatedAt: new Date() });
        return { ...row };
      },

      updateMany: async (args: Row = {}) => {
        const rows = this.table(model).filter((r) => this.matchesWhere(model, r, args.where));
        for (const row of rows) Object.assign(row, isPlainObject(args.data) ? args.data : {});
        return { count: rows.length };
      },

      delete: async (args: Row = {}) => {
        const rows = this.table(model);
        const index = rows.findIndex((r) => this.matchesWhere(model, r, args.where));
        if (index === -1) throw new Error(`fakeDb: ${model} to delete not found.`);
        return { ...rows.splice(index, 1)[0] };
      },

      deleteMany: async (args: Row = {}) => {
        const rows = this.table(model);
        const keep = rows.filter((r) => !this.matchesWhere(model, r, args.where));
        const removed = rows.length - keep.length;
        this.tables.set(model, keep);
        return { count: removed };
      },
    });

    const cache = new Map<string, unknown>();

    return new Proxy(
      {
        /** Marker asserted by tests/unit/production-safety.test.ts. */
        __isFakeDb: true,
        $transaction: async (input: unknown) => {
          if (Array.isArray(input)) return Promise.all(input);
          if (typeof input === "function") return (input as (tx: unknown) => unknown)(this.client());
          throw new Error("fakeDb: unsupported $transaction argument.");
        },
        $queryRaw: async () => [{ "?column?": 1 }],
      } as Record<string, unknown>,
      {
        get(target, property: string) {
          if (property in target) return target[property];
          if (typeof property !== "string" || property.startsWith("$")) return undefined;
          if (!cache.has(property)) cache.set(property, delegate(property));
          return cache.get(property);
        },
      }
    );
  }
}
