import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { AssignmentDataDto, CreateNodeDto, VideoDataDto } from './create-node.dto.js';

class PartialVideoDataDto extends PartialType(VideoDataDto) {}
class PartialAssignmentDataDto extends PartialType(AssignmentDataDto) {}

/** Body of PATCH .../nodes/:nodeId (UpdateNodeBody). `type` may be sent but cannot change. */
export class UpdateNodeDto extends PartialType(OmitType(CreateNodeDto, ['videoData', 'assignmentData'] as const)) {
  @IsOptional()
  @ValidateNested()
  @Type(() => PartialVideoDataDto)
  videoData?: PartialVideoDataDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PartialAssignmentDataDto)
  assignmentData?: PartialAssignmentDataDto;
}
