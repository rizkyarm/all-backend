import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  ParseFilePipeBuilder,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators';

@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @CurrentUser('id') userId: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: '.(png|jpeg|jpg|pdf)',
        })
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
  ) {
    return this.filesService.uploadFile(userId, file);
  }

  @Delete(':key')
  async deleteFile(
    @CurrentUser('id') userId: string,
    @Param('key') key: string,
  ) {
    // If key contains slashes, the client MUST URL-encode it (e.g., uploads%2Ffilename.jpg)
    return this.filesService.deleteFile(userId, key);
  }

  @Get(':key/url')
  async getFileUrl(
    @CurrentUser('id') userId: string,
    @Param('key') key: string,
  ) {
    return this.filesService.getFileUrl(userId, key);
  }
}
