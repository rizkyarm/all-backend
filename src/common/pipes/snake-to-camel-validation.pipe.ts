import { ValidationPipe, ArgumentMetadata, Injectable } from '@nestjs/common';

function snakeToCamel(str: string): string {
  return str.replace(/([-_][a-z0-9])/g, (group) =>
    group.toUpperCase().replace('-', '').replace('_', ''),
  );
}

function convertSnakeToCamelShallow(obj: any): any {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }

  // Only transform plain objects
  if (obj.constructor && obj.constructor.name !== 'Object') {
    return obj;
  }

  return Object.keys(obj).reduce((acc, key) => {
    const camelKey = snakeToCamel(key);
    acc[camelKey] = obj[key];
    return acc;
  }, {} as any);
}

@Injectable()
export class SnakeToCamelValidationPipe extends ValidationPipe {
  async transform(value: any, metadata: ArgumentMetadata) {
    if (value && typeof value === 'object' && metadata.type === 'body') {
      value = convertSnakeToCamelShallow(value);
    }
    return super.transform(value, metadata);
  }
}
