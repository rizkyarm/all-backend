import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
  ParseFilePipeBuilder,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Public } from '../auth/decorators';
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
          fileType: /^image\/(png|jpe?g)|application\/pdf$/,
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

  /**
   * Public file proxy — must be defined BEFORE :key/url to match first.
   */
  @Public()
  @Get('proxy/*')
  async proxyFile(@Req() req: Request, @Res() res: Response) {
    // Extract the key from URL: /api/v1/files/proxy/<key>
    const url = req.url; // e.g. /api/v1/files/proxy/uploads%2Ffile.png
    const key = url.split('/proxy/')[1] || '';
    if (!key) {
      return res.status(400).json({ error: 'No file key provided' });
    }
    const { buffer, mimetype } = await this.filesService.streamFile(
      decodeURIComponent(key),
    );
    res.setHeader('Content-Type', mimetype);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(buffer);
  }

  @Get(':key/url')
  async getFileUrl(
    @CurrentUser('id') userId: string,
    @Param('key') key: string,
  ) {
    return this.filesService.getFileUrl(userId, key);
  }
}
