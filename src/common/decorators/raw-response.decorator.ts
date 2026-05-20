import { SetMetadata } from '@nestjs/common';

export const IS_RAW_RESPONSE_KEY = 'isRawResponse';
export const RawResponse = () => SetMetadata(IS_RAW_RESPONSE_KEY, true);
