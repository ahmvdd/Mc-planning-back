import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';
import { EmployeesImportService } from './employees-import.service';

@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly employeesImportService: EmployeesImportService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Req() req: { user?: { orgId?: number; role?: string; sub?: number } }) {
    return this.employeesService.findAll(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() req: { user?: { orgId?: number; role?: string; sub?: number } },
  ) {
    return this.employeesService.findOne(Number(id), req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  create(
    @Body() dto: CreateEmployeeDto,
    @Req() req: { user?: { orgId?: number } },
  ) {
    return this.employeesService.create(dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('import')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async importCsv(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { user?: { orgId?: number } },
  ) {
    if (!file) return { error: 'Aucun fichier reçu' };
    return this.employeesImportService.importFromBuffer(
      file.buffer,
      file.mimetype,
      req.user?.orgId ?? 0,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(
    @Body() body: { name?: string; password?: string },
    @Req() req: { user?: { orgId?: number; sub?: number } },
  ) {
    return this.employeesService.updateMe(body, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @Req() req: { user?: { orgId?: number } },
  ) {
    return this.employeesService.update(Number(id), dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: { user?: { orgId?: number } }) {
    this.employeesService.remove(Number(id), req.user);
    return { status: 'deleted' };
  }
}
