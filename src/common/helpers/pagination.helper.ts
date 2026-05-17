import { PaginationDto } from '../dto';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PrismaModelDelegate {
  findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
  count: (args: Record<string, unknown>) => Promise<number>;
}

interface PaginateArgs {
  where?: Record<string, unknown>;
  select?: Record<string, unknown>;
  include?: Record<string, unknown>;
  orderBy?: Record<string, string>;
}

/**
 * Generic pagination helper for Prisma models.
 * @param model Prisma model delegate (e.g. prisma.client.user)
 * @param dto Pagination configuration (page, limit, sortBy, sortOrder)
 * @param args Additional Prisma query arguments (where, select, include)
 */
export async function paginate<T>(
  model: PrismaModelDelegate,
  dto: PaginationDto,
  args: PaginateArgs = {},
): Promise<PaginatedResult<T>> {
  const page = Number(dto.page) || 1;
  const limit = Number(dto.limit) || 10;
  const skip = (page - 1) * limit;

  // Build the orderBy clause. If args.orderBy is provided, it overrides dto.sortBy
  const orderBy =
    args.orderBy ||
    (dto.sortBy ? { [dto.sortBy]: dto.sortOrder || 'desc' } : undefined);

  const findManyArgs: Record<string, unknown> = {
    ...args,
    skip,
    take: limit,
    ...(orderBy && { orderBy }),
  };

  const countArgs: Record<string, unknown> = {
    where: args.where,
  };

  const [data, total] = await Promise.all([
    model.findMany(findManyArgs) as Promise<T[]>,
    model.count(countArgs),
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
