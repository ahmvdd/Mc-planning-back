import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { RequestsService } from './requests.service';

@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @Query('employeeId') employeeId: string | undefined,
    @Req() req: { user?: { orgId?: number; role?: string; sub?: number } },
  ) {
    return this.requestsService.findAll(
      employeeId ? Number(employeeId) : undefined,
      req.user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() dto: CreateRequestDto,
    @Req() req: { user?: { orgId?: number; sub?: number; role?: string } },
  ) {
    return this.requestsService.create(dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRequestDto,
    @Req() req: { user?: { orgId?: number } },
  ) {
    return this.requestsService.update(Number(id), dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: { user?: { orgId?: number } }) {
    this.requestsService.remove(Number(id), req.user);
    return { status: 'deleted' };
  }
}
