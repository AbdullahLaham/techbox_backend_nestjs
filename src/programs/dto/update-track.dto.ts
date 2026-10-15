import { PartialType } from '@nestjs/mapped-types';
import { CreateTrackDto } from './create-track.dto.js';

export class UpdateTrackDto extends PartialType(CreateTrackDto) {}