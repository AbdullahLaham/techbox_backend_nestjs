import { PartialType } from '@nestjs/mapped-types';
import { CreateNodeDto } from './create-node.dto.js';

export class UpdateNodeDto extends PartialType(CreateNodeDto) {}