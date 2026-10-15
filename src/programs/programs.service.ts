// import { Injectable, NotFoundException } from '@nestjs/common';
// import { PrismaService } from '../prisma/prisma.service.js';
// import { CreateProgramDto } from './dto/create-program.dto.js';
// import { CreateTrackDto } from './dto/create-track.dto.js';
// import { CreateModuleDto } from './dto/create-module.dto.js';
// import { CreateNodeDto } from './dto/create-node.dto.js';

// @Injectable()
// export class ProgramsService {
//   constructor(private readonly prisma: PrismaService) {}

//   // 1. جلب جميع البرامج
//   async findAll(includeDrafts = false) {
//     return this.prisma.program.findMany({
//       where: includeDrafts ? {} : { status: 'PUBLISHED' },
//       include: {
//         _count: {
//           select: { enrollments: true, tracks: true },
//         },
//       },
//       orderBy: { createdAt: 'desc' },
//     });
//   }

//   // 2. جلب برنامج مع هيكله الكامل (Tracks -> Modules -> Nodes -> Video/Assignment)
//   async findOneWithStructure(slug: string) {
//     const program = await this.prisma.program.findUnique({
//       where: { slug },
//       include: {
//         tracks: {
//           orderBy: { orderIndex: 'asc' },
//           include: {
//             modules: {
//               orderBy: { orderIndex: 'asc' },
//               include: {
//                 nodes: {
//                   orderBy: { orderIndex: 'asc' },
//                   include: {
//                     video: true,
//                     assignment: true,
//                   },
//                 },
//               },
//             },
//           },
//         },
//       },
//     });

//     if (!program) {
//       throw new NotFoundException(`البرنامج برمز ${slug} غير موجود`);
//     }

//     return program;
//   }

//   // 3. إنشاء برنامج جديد
//   async create(dto: CreateProgramDto) {
//     return this.prisma.program.create({
//       data: dto,
//     });
//   }

//   // 4. إضافة مسار (Track) للبرنامج
//   async createTrack(programId: string, dto: CreateTrackDto) {
//     const program = await this.prisma.program.findUnique({ where: { id: programId } });
//     if (!program) throw new NotFoundException('البرنامج غير موجود');

//     return this.prisma.track.create({
//       data: { ...dto, programId },
//     });
//   }

//   // 5. إضافة وحدة (Module) للمسار
//   async createModule(trackId: string, dto: CreateModuleDto) {
//     const track = await this.prisma.track.findUnique({ where: { id: trackId } });
//     if (!track) throw new NotFoundException('المسار غير موجود');

//     return this.prisma.module.create({
//       data: { ...dto, trackId },
//     });
//   }

//   // 6. إضافة عقد نشاط (ActivityNode) مع دعم الفيديو أو الواجب
//   async createNode(moduleId: string, dto: CreateNodeDto) {
//     const module = await this.prisma.module.findUnique({ where: { id: moduleId } });
//     if (!module) throw new NotFoundException('الوحدة غير موجودة');

//     const { videoData, assignmentData, ...nodeData } = dto;

//     return this.prisma.$transaction(async (tx) => {
//       const node = await tx.activityNode.create({
//         data: { ...nodeData, moduleId },
//       });

//       if (node.type === 'VIDEO_LECTURE' && videoData) {
//         await tx.videoAsset.create({
//           data: {
//             nodeId: node.id,
//             externalId: videoData.externalId,
//             durationSec: videoData.durationSec,
//             playbackUrl: videoData.playbackUrl,
//             transcodeState: 'READY',
//           },
//         });
//       }

//       if (node.type === 'ASSIGNMENT' && assignmentData) {
//         await tx.assignment.create({
//           data: {
//             nodeId: node.id,
//             instructions: assignmentData.instructions,
//             allowedType: assignmentData.allowedType || 'URL_LINK',
//             maxScore: assignmentData.maxScore || 100,
//             dueDate: assignmentData.dueDate ? new Date(assignmentData.dueDate) : undefined,
//           },
//         });
//       }

//       return node;
//     });
//   }
// }











import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProgramDto } from './dto/create-program.dto.js';
import { UpdateProgramDto } from './dto/update-program.dto.js';
import { CreateTrackDto } from './dto/create-track.dto.js';
import { UpdateTrackDto } from './dto/update-track.dto.js';
import { CreateModuleDto } from './dto/create-module.dto.js';
import { UpdateModuleDto } from './dto/update-module.dto.js';
import { CreateNodeDto } from './dto/create-node.dto.js';
import { UpdateNodeDto } from './dto/update-node.dto.js';

@Injectable()
export class ProgramsService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== 1. PROGRAMS CRUD ====================

  async findAll(includeDrafts = false) {
    return this.prisma.program.findMany({
      where: includeDrafts ? {} : { status: 'PUBLISHED' },
      include: {
        _count: {
          select: { enrollments: true, tracks: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneWithStructure(slug: string) {
    const program = await this.prisma.program.findUnique({
      where: { slug },
      include: {
        tracks: {
          orderBy: { orderIndex: 'asc' },
          include: {
            modules: {
              orderBy: { orderIndex: 'asc' },
              include: {
                nodes: {
                  orderBy: { orderIndex: 'asc' },
                  include: {
                    video: true,
                    assignment: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!program) {
      throw new NotFoundException(`البرنامج برمز ${slug} غير موجود`);
    }

    return program;
  }

  async create(dto: CreateProgramDto) {
    return this.prisma.program.create({ data: dto });
  }

  async updateProgram(id: string, dto: UpdateProgramDto) {
    const program = await this.prisma.program.findUnique({ where: { id } });
    if (!program) throw new NotFoundException('البرنامج غير موجود');

    return this.prisma.program.update({
      where: { id },
      data: dto,
    });
  }

  async removeProgram(id: string) {
    const program = await this.prisma.program.findUnique({ where: { id } });
    if (!program) throw new NotFoundException('البرنامج غير موجود');

    return this.prisma.program.delete({ where: { id } });
  }

  // ==================== 2. TRACKS CRUD ====================

  async createTrack(programId: string, dto: CreateTrackDto) {
    const program = await this.prisma.program.findUnique({ where: { id: programId } });
    if (!program) throw new NotFoundException('البرنامج غير موجود');

    return this.prisma.track.create({
      data: { ...dto, programId },
    });
  }

  async updateTrack(trackId: string, dto: UpdateTrackDto) {
    const track = await this.prisma.track.findUnique({ where: { id: trackId } });
    if (!track) throw new NotFoundException('المسار غير موجود');

    return this.prisma.track.update({
      where: { id: trackId },
      data: dto,
    });
  }

  async removeTrack(trackId: string) {
    const track = await this.prisma.track.findUnique({ where: { id: trackId } });
    if (!track) throw new NotFoundException('المسار غير موجود');

    return this.prisma.track.delete({ where: { id: trackId } });
  }

  // ==================== 3. MODULES CRUD ====================

  async createModule(trackId: string, dto: CreateModuleDto) {
    const track = await this.prisma.track.findUnique({ where: { id: trackId } });
    if (!track) throw new NotFoundException('المسار غير موجود');

    return this.prisma.module.create({
      data: { ...dto, trackId },
    });
  }

  async updateModule(moduleId: string, dto: UpdateModuleDto) {
    const module = await this.prisma.module.findUnique({ where: { id: moduleId } });
    if (!module) throw new NotFoundException('الوحدة غير موجودة');

    return this.prisma.module.update({
      where: { id: moduleId },
      data: dto,
    });
  }

  async removeModule(moduleId: string) {
    const module = await this.prisma.module.findUnique({ where: { id: moduleId } });
    if (!module) throw new NotFoundException('الوحدة غير موجودة');

    return this.prisma.module.delete({ where: { id: moduleId } });
  }

  // ==================== 4. ACTIVITY NODES CRUD ====================

  async createNode(moduleId: string, dto: CreateNodeDto) {
    const module = await this.prisma.module.findUnique({ where: { id: moduleId } });
    if (!module) throw new NotFoundException('الوحدة غير موجودة');

    const { videoData, assignmentData, ...nodeData } = dto;

    return this.prisma.$transaction(async (tx) => {
      const node = await tx.activityNode.create({
        data: { ...nodeData, moduleId },
      });

      if (node.type === 'VIDEO_LECTURE' && videoData) {
        await tx.videoAsset.create({
          data: {
            nodeId: node.id,
            externalId: videoData.externalId,
            durationSec: videoData.durationSec,
            playbackUrl: videoData.playbackUrl,
            transcodeState: 'READY',
          },
        });
      }

      if (node.type === 'ASSIGNMENT' && assignmentData) {
        await tx.assignment.create({
          data: {
            nodeId: node.id,
            instructions: assignmentData.instructions,
            allowedType: assignmentData.allowedType || 'URL_LINK',
            maxScore: assignmentData.maxScore || 100,
            dueDate: assignmentData.dueDate ? new Date(assignmentData.dueDate) : undefined,
          },
        });
      }

      return node;
    });
  }

  async updateNode(nodeId: string, dto: UpdateNodeDto) {
    const node = await this.prisma.activityNode.findUnique({ where: { id: nodeId } });
    if (!node) throw new NotFoundException('العقد أو الدرس غير موجود');

    const { videoData, assignmentData, ...nodeData } = dto;

    return this.prisma.$transaction(async (tx) => {
      // تحديث بيانات العقد الأساسية
      const updatedNode = await tx.activityNode.update({
        where: { id: nodeId },
        data: nodeData,
      });

      // تحديث تفاصيل الفيديو إذا وجدت
      if (videoData) {
        await tx.videoAsset.upsert({
          where: { nodeId },
          update: videoData,
          create: {
            nodeId,
            externalId: videoData.externalId || '',
            durationSec: videoData.durationSec || 0,
            playbackUrl: videoData.playbackUrl || '',
          },
        });
      }

      // تحديث تفاصيل الواجب إذا وجدت
      if (assignmentData) {
        await tx.assignment.upsert({
          where: { nodeId },
          update: {
            ...assignmentData,
            dueDate: assignmentData.dueDate ? new Date(assignmentData.dueDate) : undefined,
          },
          create: {
            nodeId,
            instructions: assignmentData.instructions || '',
            maxScore: assignmentData.maxScore || 100,
          },
        });
      }

      return updatedNode;
    });
  }

  async removeNode(nodeId: string) {
    const node = await this.prisma.activityNode.findUnique({ where: { id: nodeId } });
    if (!node) throw new NotFoundException('العقد أو الدرس غير موجود');

    return this.prisma.activityNode.delete({ where: { id: nodeId } });
  }
}