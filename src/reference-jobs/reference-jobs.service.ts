import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

import { ReferenceJob } from './reference-job.entity';

type CreateReferenceJobBody = {
  name?: string;
  sourceType?: string;
  esxFileName?: string | null;
  esxOriginalName?: string | null;
  esxStoragePath?: string | null;
  panoCount?: number | string | null;
  panoFiles?: string[] | null;
  cameraModel?: string | null;
  captureDate?: string | null;
  projectLabel?: string | null;
  notes?: string | null;
  metadata?: Record<string, any> | null;
};

type ZipInspectionResult = {
  canInspectZip: boolean;
  entryNames: string[];
  error: string | null;
};

type ZipEntry = {
  fileName: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  generalPurposeBitFlag: number;
};

type ZipEntryContentResult = {
  found: boolean;
  entry: ZipEntry | null;
  decompressed: boolean;
  contentBuffer: Buffer | null;
  error: string | null;
};

type TextAnalysisResult = {
  preview: string | null;
  looksTextLike: boolean;
  looksXmlLike: boolean;
  detectedEncoding: string | null;
};

type ByteFrequencyItem = {
  byte: number;
  hex: string;
  count: number;
  percentage: number;
  printable: string | null;
};

@Injectable()
export class ReferenceJobsService {
  constructor(
    @InjectRepository(ReferenceJob)
    private readonly referenceJobsRepo: Repository<ReferenceJob>,
  ) {}

  findAll() {
    return this.referenceJobsRepo.find({
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number) {
    const job = await this.referenceJobsRepo.findOne({
      where: { id },
    });

    if (!job) {
      return { error: 'Reference job not found' };
    }

    return job;
  }

  async create(body: CreateReferenceJobBody) {
    const panoFiles = Array.isArray(body.panoFiles) ? body.panoFiles : [];

    const job = this.referenceJobsRepo.create({
      name: body.name || 'Untitled Reference Job',
      sourceType: body.sourceType || 'esx-pano-reference',
      esxFileName: body.esxFileName ?? null,
      esxOriginalName: body.esxOriginalName ?? body.esxFileName ?? null,
      esxStoragePath: body.esxStoragePath ?? null,
      panoCount:
        body.panoCount != null ? Number(body.panoCount) : panoFiles.length,
      panoFiles,
      cameraModel: body.cameraModel ?? null,
      captureDate: body.captureDate ?? null,
      projectLabel: body.projectLabel ?? null,
      notes: body.notes ?? null,
      metadata: body.metadata ?? null,
    });

    return this.referenceJobsRepo.save(job);
  }

  async update(id: number, body: CreateReferenceJobBody) {
    const job = await this.referenceJobsRepo.findOne({
      where: { id },
    });

    if (!job) {
      return { error: 'Reference job not found' };
    }

    if (body.name !== undefined) {
      job.name = body.name || job.name;
    }

    if (body.sourceType !== undefined) {
      job.sourceType = body.sourceType || 'esx-pano-reference';
    }

    if (body.esxFileName !== undefined) {
      job.esxFileName = body.esxFileName ?? null;
    }

    if (body.esxOriginalName !== undefined) {
      job.esxOriginalName = body.esxOriginalName ?? null;
    }

    if (body.esxStoragePath !== undefined) {
      job.esxStoragePath = body.esxStoragePath ?? null;
    }

    if (body.panoFiles !== undefined) {
      job.panoFiles = Array.isArray(body.panoFiles) ? body.panoFiles : [];
    }

    if (body.panoCount !== undefined) {
      job.panoCount =
        body.panoCount != null
          ? Number(body.panoCount)
          : Array.isArray(job.panoFiles)
            ? job.panoFiles.length
            : 0;
    }

    if (body.cameraModel !== undefined) {
      job.cameraModel = body.cameraModel ?? null;
    }

    if (body.captureDate !== undefined) {
      job.captureDate = body.captureDate ?? null;
    }

    if (body.projectLabel !== undefined) {
      job.projectLabel = body.projectLabel ?? null;
    }

    if (body.notes !== undefined) {
      job.notes = body.notes ?? null;
    }

    if (body.metadata !== undefined) {
      job.metadata = body.metadata ?? null;
    }

    return this.referenceJobsRepo.save(job);
  }

  async inspectEsx(id: number) {
    const job = await this.referenceJobsRepo.findOne({
      where: { id },
    });

    if (!job) {
      return { error: 'Reference job not found' };
    }

    const esxStoragePath = job.esxStoragePath ?? null;
    const absolutePath = esxStoragePath
      ? this.resolveLocalStoragePath(esxStoragePath)
      : null;

    const fileExists = absolutePath ? fs.existsSync(absolutePath) : false;

    const expectedEntries = ['XACTDOC.ZIPXML'];
    const nextActions: string[] = [];

    if (!esxStoragePath) {
      nextActions.push(
        'Set esxStoragePath on the reference job before ESX inspection can read the file.',
      );
    }

    if (esxStoragePath && !fileExists) {
      nextActions.push(
        'Copy the ESX file into the backend uploads path saved in esxStoragePath.',
      );
    }

    if (!absolutePath || !fileExists) {
      return {
        referenceJob: this.toReferenceJobSummary(job),
        esx: {
          esxFileName: job.esxFileName ?? null,
          esxOriginalName: job.esxOriginalName ?? null,
          esxStoragePath,
          absolutePath,
          storagePathSet: Boolean(esxStoragePath),
          fileExists: false,
          fileSizeBytes: null,
          firstBytesHex: null,
          looksLikeZipContainer: false,
          expectedEntries,
          foundEntries: [],
          missingExpectedEntries: expectedEntries,
        },
        parser: {
          status: 'file-not-available',
          canInspectContainer: false,
          canParseXactDoc: false,
          message:
            'ESX storage path is missing or the file does not exist on disk.',
        },
        nextActions,
      };
    }

    const stat = fs.statSync(absolutePath);
    const firstBytes = this.readFirstBytesHex(absolutePath, 8);
    const looksLikeZipContainer =
      firstBytes.startsWith('504b0304') ||
      firstBytes.startsWith('504b0506') ||
      firstBytes.startsWith('504b0708');

    const zipInspection = looksLikeZipContainer
      ? this.inspectZipEntries(absolutePath)
      : {
          canInspectZip: false,
          entryNames: [],
          error: 'File does not look like a ZIP/ESX container.',
        };

    const foundEntries = zipInspection.entryNames;
    const missingExpectedEntries = expectedEntries.filter(
      (entry) => !foundEntries.includes(entry),
    );

    const hasXactDoc = foundEntries.includes('XACTDOC.ZIPXML');

    if (!looksLikeZipContainer) {
      nextActions.push(
        'Confirm this file is a valid ESX container. Expected ZIP-style magic bytes.',
      );
    }

    if (looksLikeZipContainer && zipInspection.error) {
      nextActions.push(
        'Container exists, but ZIP entry inspection failed. Add a stronger ESX/ZIP parser next.',
      );
    }

    if (looksLikeZipContainer && !hasXactDoc) {
      nextActions.push(
        'Container is readable, but XACTDOC.ZIPXML was not found. Inspect entries and update parser expectations.',
      );
    }

    if (hasXactDoc) {
      nextActions.push(
        'Next parser step: extract and inspect XACTDOC.ZIPXML contents for room/estimate structure.',
      );
    }

    return {
      referenceJob: this.toReferenceJobSummary(job),
      esx: {
        esxFileName: job.esxFileName ?? null,
        esxOriginalName: job.esxOriginalName ?? null,
        esxStoragePath,
        absolutePath,
        storagePathSet: Boolean(esxStoragePath),
        fileExists,
        fileSizeBytes: stat.size,
        firstBytesHex: firstBytes,
        looksLikeZipContainer,
        expectedEntries,
        foundEntries,
        missingExpectedEntries,
      },
      parser: {
        status: hasXactDoc
          ? 'container-inspected'
          : looksLikeZipContainer
            ? 'container-readable-missing-expected-entry'
            : 'not-zip-container',
        canInspectContainer:
          looksLikeZipContainer && zipInspection.canInspectZip,
        canParseXactDoc: false,
        message: hasXactDoc
          ? 'ESX container is readable and XACTDOC.ZIPXML was found. XACTDOC content parsing is the next step.'
          : zipInspection.error ||
            'ESX inspection completed, but expected XACTDOC.ZIPXML was not found.',
      },
      nextActions,
    };
  }

  async inspectXactDoc(id: number) {
    const extractionResult = await this.getXactDocExtraction(id);

    if ('error' in extractionResult) {
      return extractionResult;
    }

    const { job, extraction } = extractionResult;
    const contentBuffer = extraction.contentBuffer;
    const contentSizeBytes = contentBuffer ? contentBuffer.length : null;
    const firstBytesHex = contentBuffer
      ? contentBuffer.subarray(0, 32).toString('hex')
      : null;

    const textAnalysis = contentBuffer
      ? this.analyzeTextContent(contentBuffer)
      : {
          preview: null,
          looksTextLike: false,
          looksXmlLike: false,
          detectedEncoding: null,
        };

    const nextActions: string[] = [];

    if (!extraction.decompressed) {
      nextActions.push(
        'XACTDOC.ZIPXML was found but could not be decompressed. Add support for this compression method or inspect the raw bytes.',
      );
    } else if (!textAnalysis.looksTextLike) {
      nextActions.push(
        'XACTDOC.ZIPXML decompressed, but does not look like readable text/XML. It may be encoded, encrypted, or binary-packed.',
      );
    } else if (!textAnalysis.looksXmlLike) {
      nextActions.push(
        'XACTDOC.ZIPXML decompressed as text, but does not look like XML. Inspect preview and add format-specific parsing.',
      );
    } else {
      nextActions.push(
        'Next parser step: parse XML tags and identify estimate, rooms, dimensions, openings, and line items.',
      );
    }

    const canParseXactDoc =
      extraction.decompressed &&
      textAnalysis.looksTextLike &&
      textAnalysis.looksXmlLike;

    return {
      referenceJob: this.toReferenceJobSummary(job),
      xactdoc: {
        found: true,
        entryName: extraction.entry?.fileName ?? 'XACTDOC.ZIPXML',
        compressedSizeBytes: extraction.entry?.compressedSize ?? null,
        uncompressedSizeBytes: extraction.entry?.uncompressedSize ?? null,
        compressionMethod: extraction.entry?.compressionMethod ?? null,
        compressionMethodLabel: extraction.entry
          ? this.getCompressionMethodLabel(extraction.entry.compressionMethod)
          : null,
        generalPurposeBitFlag: extraction.entry?.generalPurposeBitFlag ?? null,
        decompressed: extraction.decompressed,
        contentSizeBytes,
        firstBytesHex,
        preview: textAnalysis.preview,
        looksTextLike: textAnalysis.looksTextLike,
        looksXmlLike: textAnalysis.looksXmlLike,
        detectedEncoding: textAnalysis.detectedEncoding,
      },
      parser: {
        status: canParseXactDoc
          ? 'xactdoc-readable-xml'
          : extraction.decompressed
            ? 'xactdoc-extracted-needs-decoding'
            : 'xactdoc-found-not-decompressed',
        canInspectXactDoc: true,
        canParseXactDoc,
        message: canParseXactDoc
          ? 'XACTDOC.ZIPXML was extracted and appears to be readable XML.'
          : extraction.error ||
            'XACTDOC.ZIPXML was extracted but is not ready for XML parsing yet.',
      },
      nextActions,
    };
  }

  async profileXactDoc(id: number) {
    const extractionResult = await this.getXactDocExtraction(id);

    if ('error' in extractionResult) {
      return extractionResult;
    }

    const { job, extraction } = extractionResult;

    if (!extraction.contentBuffer) {
      return {
        referenceJob: this.toReferenceJobSummary(job),
        xactdoc: {
          found: extraction.found,
          entryName: 'XACTDOC.ZIPXML',
          decompressed: extraction.decompressed,
          error: extraction.error,
        },
        profile: null,
        parser: {
          status: 'xactdoc-not-profiled',
          recommendation:
            'XACTDOC.ZIPXML could not be extracted. Run ESX inspection and verify container entries.',
        },
      };
    }

    const buffer = extraction.contentBuffer;
    const profile = this.buildXactDocProfile(buffer);
    const recommendation = this.buildXactDocProfileRecommendation(profile);

    return {
      referenceJob: this.toReferenceJobSummary(job),
      xactdoc: {
        found: true,
        entryName: extraction.entry?.fileName ?? 'XACTDOC.ZIPXML',
        compressedSizeBytes: extraction.entry?.compressedSize ?? null,
        uncompressedSizeBytes: extraction.entry?.uncompressedSize ?? null,
        compressionMethod: extraction.entry?.compressionMethod ?? null,
        compressionMethodLabel: extraction.entry
          ? this.getCompressionMethodLabel(extraction.entry.compressionMethod)
          : null,
        generalPurposeBitFlag: extraction.entry?.generalPurposeBitFlag ?? null,
        decompressed: extraction.decompressed,
        contentSizeBytes: buffer.length,
      },
      profile,
      parser: {
        status: 'xactdoc-profiled',
        recommendation,
      },
    };
  }

  async summarizeXactDoc(id: number) {
    const extractionResult = await this.getXactDocExtraction(id);

    if ('error' in extractionResult) {
      return extractionResult;
    }

    const { job, extraction } = extractionResult;

    if (!extraction.contentBuffer) {
      return {
        referenceJob: this.toReferenceJobSummary(job),
        xactdoc: {
          found: extraction.found,
          decompressed: extraction.decompressed,
          error: extraction.error,
        },
        summary: null,
        parser: {
          status: 'xactdoc-summary-unavailable',
          recommendation:
            'XACTDOC.ZIPXML could not be extracted. Run ESX inspection first.',
        },
      };
    }

    const buffer = extraction.contentBuffer;
    const profile = this.buildXactDocProfile(buffer);
    const recommendation = this.buildXactDocProfileRecommendation(profile);

    const xmlMarkerHits = profile.xmlMarkers.filter(
      (marker: any) => marker.foundInUtf8 || marker.foundInUtf16Le,
    );

    const nestedCompressionSuccesses = Object.entries(
      profile.nestedCompression.attempts || {},
    )
      .filter(([, value]: any) => Boolean(value?.success))
      .map(([key, value]: any) => ({
        method: key,
        outputSizeBytes: value.outputSizeBytes,
        firstBytesHex: value.firstBytesHex,
        firstBytesAscii: value.firstBytesAscii,
      }));

    return {
      referenceJob: this.toReferenceJobSummary(job),
      xactdoc: {
        found: true,
        entryName: extraction.entry?.fileName ?? 'XACTDOC.ZIPXML',
        compressionMethod: extraction.entry?.compressionMethod ?? null,
        compressionMethodLabel: extraction.entry
          ? this.getCompressionMethodLabel(extraction.entry.compressionMethod)
          : null,
        compressedSizeBytes: extraction.entry?.compressedSize ?? null,
        uncompressedSizeBytes: extraction.entry?.uncompressedSize ?? null,
        decompressed: extraction.decompressed,
        contentSizeBytes: buffer.length,
      },
      summary: {
        firstBytesHex: profile.firstBytesHex,
        firstBytesAscii: profile.firstBytesAscii,
        entropy: profile.byteProfile.entropy,
        printableAsciiPercentage:
          profile.byteProfile.printableAsciiPercentage,
        highBytePercentage: profile.byteProfile.highBytePercentage,
        nullBytePercentage: profile.byteProfile.nullBytePercentage,
        controlBytePercentage: profile.byteProfile.controlBytePercentage,
        looksTextLike: profile.textAnalysis.looksTextLike,
        looksXmlLike: profile.textAnalysis.looksXmlLike,
        detectedEncoding: profile.textAnalysis.detectedEncoding,
        xmlMarkerHitCount: xmlMarkerHits.length,
        xmlMarkerHits,
        nestedCompressionSuccessCount: nestedCompressionSuccesses.length,
        nestedCompressionSuccesses,
        readableStringCount: profile.readableStrings.length,
        readableStringsPreview: profile.readableStrings.slice(0, 30),
        topByteFrequencies: profile.byteProfile.topByteFrequencies.slice(0, 12),
      },
      parser: {
        status: 'xactdoc-summary-ready',
        likelyFormat: this.classifyXactDocProfile(profile),
        recommendation,
      },
    };
  }

  async seedMike2350LodiReferenceJob() {
    const existing = await this.referenceJobsRepo.findOne({
      where: {
        name: 'MIKE-2350LODI / SBender',
      },
    });

    if (existing) {
      return existing;
    }

    const panoFiles = [
      'IMG_20260521_144052_00_465.insp',
      'IMG_20260521_144108_00_466.insp',
      'IMG_20260521_144123_00_467.insp',
      'IMG_20260521_144141_00_468.insp',
      'IMG_20260521_144205_00_469.insp',
      'IMG_20260521_144222_00_470.insp',
      'IMG_20260521_144235_00_471.insp',
      'IMG_20260521_144248_00_472.insp',
      'IMG_20260521_144305_00_473.insp',
      'IMG_20260521_144317_00_474.insp',
      'IMG_20260521_144333_00_475.insp',
      'IMG_20260521_144351_00_476.insp',
      'IMG_20260521_144413_00_477.insp',
      'IMG_20260521_144441_00_478.insp',
      'IMG_20260521_144452_00_479.insp',
      'IMG_20260521_144508_00_480.insp',
      'IMG_20260521_144519_00_481.insp',
      'IMG_20260521_144545_00_482.insp',
      'IMG_20260521_144558_00_483.insp',
      'IMG_20260521_144612_00_484.insp',
      'IMG_20260521_144629_00_485.insp',
      'IMG_20260521_144640_00_486.insp',
      'IMG_20260521_144659_00_487.insp',
      'IMG_20260521_144709_00_488.insp',
      'IMG_20260521_144720_00_489.insp',
      'IMG_20260521_144730_00_490.insp',
      'IMG_20260521_144742_00_491.insp',
      'IMG_20260521_144757_00_492.insp',
      'IMG_20260521_144809_00_493.insp',
      'IMG_20260521_144818_00_494.insp',
      'IMG_20260521_144844_00_495.insp',
      'IMG_20260521_144855_00_496.insp',
      'IMG_20260521_144910_00_497.insp',
      'IMG_20260521_144925_00_498.insp',
      'IMG_20260521_144953_00_499.insp',
      'IMG_20260521_145116_00_500.insp',
      'IMG_20260521_145144_00_501.insp',
      'IMG_20260521_145203_00_502.insp',
      'IMG_20260521_145221_00_503.insp',
      'IMG_20260521_145234_00_504.insp',
      'IMG_20260521_145258_00_505.insp',
      'IMG_20260521_145317_00_506.insp',
      'IMG_20260521_145337_00_507.insp',
      'IMG_20260521_145400_00_508.insp',
      'IMG_20260521_145436_00_509.insp',
      'IMG_20260521_145456_00_510.insp',
      'IMG_20260521_145511_00_511.insp',
      'IMG_20260521_145529_00_512.insp',
      'IMG_20260521_145540_00_513.insp',
      'IMG_20260521_145601_00_514.insp',
      'IMG_20260521_145619_00_515.insp',
      'IMG_20260521_145631_00_516.insp',
      'IMG_20260521_145644_00_517.insp',
      'IMG_20260521_145653_00_518.insp',
      'IMG_20260521_145702_00_519.insp',
      'IMG_20260521_145721_00_520.insp',
      'IMG_20260521_145743_00_521.insp',
      'IMG_20260521_145809_00_522.insp',
      'IMG_20260521_145818_00_523.insp',
      'IMG_20260521_145835_00_524.insp',
      'IMG_20260521_145901_00_525.insp',
      'IMG_20260521_145914_00_526.insp',
      'IMG_20260521_145925_00_527.insp',
      'IMG_20260521_145940_00_528.insp',
      'IMG_20260521_150003_00_529.insp',
      'IMG_20260521_150018_00_530.insp',
      'IMG_20260521_150030_00_531.insp',
      'IMG_20260521_150044_00_532.insp',
      'IMG_20260521_150104_00_533.insp',
      'IMG_20260521_150626_00_534.insp',
      'IMG_20260521_150636_00_535.insp',
      'IMG_20260521_150649_00_536.insp',
      'IMG_20260521_150659_00_537.insp',
      'IMG_20260521_150711_00_538.insp',
      'IMG_20260521_150738_00_539.insp',
      'IMG_20260521_150748_00_540.insp',
      'IMG_20260521_150756_00_541.insp',
    ];

    const job = this.referenceJobsRepo.create({
      name: 'MIKE-2350LODI / SBender',
      sourceType: 'esx-pano-reference',
      esxFileName: 'MIKE-2350LODI Mike~SBender.ESX',
      esxOriginalName: 'MIKE-2350LODI Mike~SBender.ESX',
      esxStoragePath: null,
      panoCount: panoFiles.length,
      panoFiles,
      cameraModel: 'Insta360 X5',
      captureDate: '2026-05-21',
      projectLabel: 'MIKE-2350LODI',
      notes:
        'Reference ESX plus matching Insta360 X5 pano sequence for future ESX conversion calibration and pano-to-room matching.',
      metadata: {
        uploadedFixture: true,
        purpose: 'ESX conversion calibration',
        expectedUse: [
          'room naming comparison',
          'wall/opening export comparison',
          'ceiling/floor/wall area comparison',
          'normalized export to ESX comparison',
          'future pano-to-room matching',
        ],
      },
    });

    return this.referenceJobsRepo.save(job);
  }

  async remove(id: number) {
    const job = await this.referenceJobsRepo.findOne({
      where: { id },
    });

    if (!job) {
      return { error: 'Reference job not found' };
    }

    await this.referenceJobsRepo.delete(id);

    return { success: true };
  }

  private async getXactDocExtraction(id: number): Promise<
    | {
        job: ReferenceJob;
        extraction: ZipEntryContentResult;
      }
    | {
        error: string;
        referenceJob?: any;
        xactdoc?: any;
        parser?: any;
        nextActions?: string[];
      }
  > {
    const job = await this.referenceJobsRepo.findOne({
      where: { id },
    });

    if (!job) {
      return { error: 'Reference job not found' };
    }

    const esxStoragePath = job.esxStoragePath ?? null;
    const absolutePath = esxStoragePath
      ? this.resolveLocalStoragePath(esxStoragePath)
      : null;

    if (!absolutePath || !fs.existsSync(absolutePath)) {
      return {
        error: 'ESX file not available',
        referenceJob: this.toReferenceJobSummary(job),
        xactdoc: {
          found: false,
          entryName: 'XACTDOC.ZIPXML',
          decompressed: false,
        },
        parser: {
          status: 'file-not-available',
          canInspectXactDoc: false,
          canParseXactDoc: false,
          message:
            'ESX file does not exist on disk. Copy the ESX file into the saved esxStoragePath first.',
        },
        nextActions: [
          'Verify esxStoragePath is set and the ESX file exists in the backend uploads folder.',
        ],
      };
    }

    const extraction = this.extractZipEntryContent(
      absolutePath,
      'XACTDOC.ZIPXML',
    );

    if (!extraction.found || !extraction.entry) {
      return {
        error: 'XACTDOC.ZIPXML not found',
        referenceJob: this.toReferenceJobSummary(job),
        xactdoc: {
          found: false,
          entryName: 'XACTDOC.ZIPXML',
          decompressed: false,
        },
        parser: {
          status: 'xactdoc-not-found',
          canInspectXactDoc: false,
          canParseXactDoc: false,
          message:
            extraction.error ||
            'XACTDOC.ZIPXML was not found inside the ESX container.',
        },
        nextActions: [
          'Run /reference-jobs/1/esx-inspection and inspect foundEntries.',
        ],
      };
    }

    return {
      job,
      extraction,
    };
  }

  private buildXactDocProfile(buffer: Buffer) {
    return {
      firstBytesHex: buffer.subarray(0, 64).toString('hex'),
      firstBytesAscii: this.bytesToSafeAscii(buffer.subarray(0, 128)),
      byteProfile: this.buildByteProfile(buffer),
      textAnalysis: this.analyzeTextContent(buffer),
      utf8Analysis: this.analyzeSpecificEncoding(buffer, 'utf8'),
      utf16LeAnalysis: this.analyzeSpecificEncoding(buffer, 'utf16le'),
      nestedCompression: this.inspectNestedCompression(buffer),
      xmlMarkers: this.searchMarkers(buffer, [
        '<?xml',
        '<xml',
        '<Xact',
        '<Estimate',
        '<CLAIM',
        '<PROJECT',
        '<DOCUMENT',
        '<ROOM',
        '<Room',
        '<Sketch',
        '<LineItem',
        '<COVERAGE',
        'XACTDOC',
        'Xactimate',
        'Estimate',
        'Room',
        'Sketch',
        'LineItem',
      ]),
      readableStrings: this.extractReadableStrings(buffer, 6, 80),
    };
  }

  private resolveLocalStoragePath(storagePath: string) {
    if (path.isAbsolute(storagePath)) {
      return path.normalize(storagePath);
    }

    return path.resolve(process.cwd(), storagePath);
  }

  private readFirstBytesHex(filePath: string, byteCount: number) {
    const fd = fs.openSync(filePath, 'r');

    try {
      const buffer = Buffer.alloc(byteCount);
      const bytesRead = fs.readSync(fd, buffer, 0, byteCount, 0);
      return buffer.subarray(0, bytesRead).toString('hex');
    } finally {
      fs.closeSync(fd);
    }
  }

  private inspectZipEntries(filePath: string): ZipInspectionResult {
    try {
      const entries = this.readZipEntries(filePath);

      return {
        canInspectZip: true,
        entryNames: entries.map((entry) => entry.fileName),
        error: null,
      };
    } catch (error) {
      return {
        canInspectZip: false,
        entryNames: [],
        error:
          error instanceof Error
            ? error.message
            : 'Unknown ZIP inspection error.',
      };
    }
  }

  private extractZipEntryContent(
    filePath: string,
    entryName: string,
  ): ZipEntryContentResult {
    try {
      const buffer = fs.readFileSync(filePath);
      const entries = this.readZipEntriesFromBuffer(buffer);
      const entry = entries.find((item) => item.fileName === entryName) || null;

      if (!entry) {
        return {
          found: false,
          entry: null,
          decompressed: false,
          contentBuffer: null,
          error: `${entryName} was not found in ZIP central directory.`,
        };
      }

      const localHeaderSignature = buffer.readUInt32LE(entry.localHeaderOffset);

      if (localHeaderSignature !== 0x04034b50) {
        return {
          found: true,
          entry,
          decompressed: false,
          contentBuffer: null,
          error: 'ZIP local file header signature is invalid.',
        };
      }

      const localFileNameLength = buffer.readUInt16LE(
        entry.localHeaderOffset + 26,
      );
      const localExtraFieldLength = buffer.readUInt16LE(
        entry.localHeaderOffset + 28,
      );

      const compressedDataStart =
        entry.localHeaderOffset +
        30 +
        localFileNameLength +
        localExtraFieldLength;

      const compressedDataEnd = compressedDataStart + entry.compressedSize;

      if (
        compressedDataStart < 0 ||
        compressedDataEnd > buffer.length ||
        compressedDataStart >= compressedDataEnd
      ) {
        return {
          found: true,
          entry,
          decompressed: false,
          contentBuffer: null,
          error: 'ZIP compressed data range is invalid.',
        };
      }

      const compressedBuffer = buffer.subarray(
        compressedDataStart,
        compressedDataEnd,
      );

      if (entry.compressionMethod === 0) {
        return {
          found: true,
          entry,
          decompressed: true,
          contentBuffer: compressedBuffer,
          error: null,
        };
      }

      if (entry.compressionMethod === 8) {
        const inflated = zlib.inflateRawSync(compressedBuffer);

        return {
          found: true,
          entry,
          decompressed: true,
          contentBuffer: inflated,
          error: null,
        };
      }

      return {
        found: true,
        entry,
        decompressed: false,
        contentBuffer: null,
        error: `Unsupported ZIP compression method ${entry.compressionMethod}.`,
      };
    } catch (error) {
      return {
        found: false,
        entry: null,
        decompressed: false,
        contentBuffer: null,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown ZIP entry extraction error.',
      };
    }
  }

  private readZipEntries(filePath: string): ZipEntry[] {
    const buffer = fs.readFileSync(filePath);
    return this.readZipEntriesFromBuffer(buffer);
  }

  private readZipEntriesFromBuffer(buffer: Buffer): ZipEntry[] {
    const eocdOffset = this.findEndOfCentralDirectory(buffer);

    if (eocdOffset < 0) {
      throw new Error('Could not find ZIP end-of-central-directory record.');
    }

    const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
    const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
    const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;

    if (
      centralDirectoryOffset < 0 ||
      centralDirectoryEnd > buffer.length ||
      centralDirectoryOffset >= centralDirectoryEnd
    ) {
      throw new Error('ZIP central directory offset/size is invalid.');
    }

    const entries: ZipEntry[] = [];
    let offset = centralDirectoryOffset;

    while (offset < centralDirectoryEnd) {
      const signature = buffer.readUInt32LE(offset);

      if (signature !== 0x02014b50) {
        break;
      }

      const generalPurposeBitFlag = buffer.readUInt16LE(offset + 8);
      const compressionMethod = buffer.readUInt16LE(offset + 10);
      const compressedSize = buffer.readUInt32LE(offset + 20);
      const uncompressedSize = buffer.readUInt32LE(offset + 24);
      const fileNameLength = buffer.readUInt16LE(offset + 28);
      const extraFieldLength = buffer.readUInt16LE(offset + 30);
      const fileCommentLength = buffer.readUInt16LE(offset + 32);
      const localHeaderOffset = buffer.readUInt32LE(offset + 42);

      const fileNameStart = offset + 46;
      const fileNameEnd = fileNameStart + fileNameLength;

      if (fileNameEnd > buffer.length) {
        break;
      }

      const fileName = buffer
        .subarray(fileNameStart, fileNameEnd)
        .toString('utf8');

      entries.push({
        fileName,
        compressionMethod,
        compressedSize,
        uncompressedSize,
        localHeaderOffset,
        generalPurposeBitFlag,
      });

      offset = fileNameEnd + extraFieldLength + fileCommentLength;
    }

    return entries;
  }

  private findEndOfCentralDirectory(buffer: Buffer) {
    const eocdSignature = 0x06054b50;
    const minEocdSize = 22;
    const maxCommentLength = 0xffff;

    const start = Math.max(0, buffer.length - minEocdSize - maxCommentLength);

    for (let offset = buffer.length - minEocdSize; offset >= start; offset--) {
      if (buffer.readUInt32LE(offset) === eocdSignature) {
        return offset;
      }
    }

    return -1;
  }

  private analyzeTextContent(buffer: Buffer): TextAnalysisResult {
    const firstBytesHex = buffer.subarray(0, 4).toString('hex');

    let detectedEncoding = 'utf8';
    let text = buffer.toString('utf8');

    if (firstBytesHex.startsWith('fffe')) {
      detectedEncoding = 'utf16le';
      text = buffer.toString('utf16le');
    } else if (firstBytesHex.startsWith('feff')) {
      detectedEncoding = 'utf16be';
      text = this.decodeUtf16Be(buffer);
    } else if (firstBytesHex.startsWith('efbbbf')) {
      detectedEncoding = 'utf8-bom';
      text = buffer.subarray(3).toString('utf8');
    }

    const preview = text
      .replace(/\u0000/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2000);

    const sample = preview.slice(0, 500);
    const printableCount = sample.split('').filter((char) => {
      const code = char.charCodeAt(0);
      return (
        code === 9 ||
        code === 10 ||
        code === 13 ||
        (code >= 32 && code < 127)
      );
    }).length;

    const looksTextLike =
      sample.length > 0 && printableCount / sample.length > 0.75;

    const looksXmlLike =
      looksTextLike &&
      (preview.startsWith('<') ||
        preview.includes('<?xml') ||
        preview.includes('<Xact') ||
        preview.includes('<Estimate') ||
        preview.includes('<CLAIM') ||
        preview.includes('<PROJECT') ||
        preview.includes('<DOCUMENT'));

    return {
      preview,
      looksTextLike,
      looksXmlLike,
      detectedEncoding,
    };
  }

  private analyzeSpecificEncoding(buffer: Buffer, encoding: BufferEncoding) {
    let text = '';

    try {
      text = buffer.toString(encoding);
    } catch (error) {
      return {
        encoding,
        readable: false,
        preview: null,
        printableRatio: 0,
        xmlMarkerCount: 0,
      };
    }

    const cleaned = text
      .replace(/\u0000/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const sample = cleaned.slice(0, 1000);
    const printableCount = sample.split('').filter((char) => {
      const code = char.charCodeAt(0);
      return (
        code === 9 ||
        code === 10 ||
        code === 13 ||
        (code >= 32 && code < 127)
      );
    }).length;

    const printableRatio =
      sample.length > 0
        ? Number((printableCount / sample.length).toFixed(4))
        : 0;

    const xmlMarkerCount = [
      '<?xml',
      '<Xact',
      '<Estimate',
      '<PROJECT',
      '<DOCUMENT',
      '<ROOM',
      '<Room',
    ].reduce((count, marker) => {
      return count + (cleaned.includes(marker) ? 1 : 0);
    }, 0);

    return {
      encoding,
      readable: printableRatio > 0.75,
      preview: cleaned.slice(0, 1000),
      printableRatio,
      xmlMarkerCount,
    };
  }

  private buildByteProfile(buffer: Buffer) {
    const byteLength = buffer.length;
    const counts = new Array<number>(256).fill(0);

    let nullByteCount = 0;
    let printableAsciiCount = 0;
    let whitespaceCount = 0;
    let controlByteCount = 0;
    let highByteCount = 0;

    for (const byte of buffer) {
      counts[byte] += 1;

      if (byte === 0) nullByteCount += 1;
      if (byte === 9 || byte === 10 || byte === 13 || byte === 32) {
        whitespaceCount += 1;
      }
      if (byte >= 32 && byte <= 126) printableAsciiCount += 1;
      if ((byte >= 0 && byte < 9) || (byte > 13 && byte < 32)) {
        controlByteCount += 1;
      }
      if (byte >= 128) highByteCount += 1;
    }

    const topByteFrequencies: ByteFrequencyItem[] = counts
      .map((count, byte) => ({
        byte,
        hex: byte.toString(16).padStart(2, '0'),
        count,
        percentage:
          byteLength > 0 ? Number(((count / byteLength) * 100).toFixed(4)) : 0,
        printable:
          byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : null,
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 24);

    return {
      byteLength,
      nullByteCount,
      nullBytePercentage: this.percent(nullByteCount, byteLength),
      printableAsciiCount,
      printableAsciiPercentage: this.percent(printableAsciiCount, byteLength),
      whitespaceCount,
      whitespacePercentage: this.percent(whitespaceCount, byteLength),
      controlByteCount,
      controlBytePercentage: this.percent(controlByteCount, byteLength),
      highByteCount,
      highBytePercentage: this.percent(highByteCount, byteLength),
      entropy: this.calculateEntropy(counts, byteLength),
      topByteFrequencies,
    };
  }

  private inspectNestedCompression(buffer: Buffer) {
    const firstBytesHex = buffer.subarray(0, 16).toString('hex');

    const signatures = {
      zip: firstBytesHex.startsWith('504b0304'),
      gzip: firstBytesHex.startsWith('1f8b'),
      zlib:
        firstBytesHex.startsWith('7801') ||
        firstBytesHex.startsWith('789c') ||
        firstBytesHex.startsWith('78da'),
    };

    const attempts: Record<string, any> = {};

    if (signatures.gzip) {
      try {
        const output = zlib.gunzipSync(buffer);
        attempts.gzip = {
          success: true,
          outputSizeBytes: output.length,
          firstBytesHex: output.subarray(0, 32).toString('hex'),
          firstBytesAscii: this.bytesToSafeAscii(output.subarray(0, 128)),
        };
      } catch (error) {
        attempts.gzip = {
          success: false,
          error:
            error instanceof Error ? error.message : 'Unknown gzip error.',
        };
      }
    }

    if (signatures.zlib) {
      try {
        const output = zlib.inflateSync(buffer);
        attempts.zlib = {
          success: true,
          outputSizeBytes: output.length,
          firstBytesHex: output.subarray(0, 32).toString('hex'),
          firstBytesAscii: this.bytesToSafeAscii(output.subarray(0, 128)),
        };
      } catch (error) {
        attempts.zlib = {
          success: false,
          error:
            error instanceof Error ? error.message : 'Unknown zlib error.',
        };
      }
    }

    try {
      const output = zlib.inflateRawSync(buffer);
      attempts.rawDeflate = {
        success: true,
        outputSizeBytes: output.length,
        firstBytesHex: output.subarray(0, 32).toString('hex'),
        firstBytesAscii: this.bytesToSafeAscii(output.subarray(0, 128)),
      };
    } catch (error) {
      attempts.rawDeflate = {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown raw deflate error.',
      };
    }

    return {
      firstBytesHex,
      signatures,
      attempts,
    };
  }

  private searchMarkers(buffer: Buffer, markers: string[]) {
    const utf8Text = buffer.toString('utf8');
    const utf16LeText = buffer.toString('utf16le');

    return markers.map((marker) => ({
      marker,
      utf8Index: utf8Text.indexOf(marker),
      utf16LeIndex: utf16LeText.indexOf(marker),
      foundInUtf8: utf8Text.includes(marker),
      foundInUtf16Le: utf16LeText.includes(marker),
    }));
  }

  private extractReadableStrings(
    buffer: Buffer,
    minLength: number,
    maxItems: number,
  ) {
    const strings: string[] = [];
    let current = '';

    for (const byte of buffer) {
      if (byte >= 32 && byte <= 126) {
        current += String.fromCharCode(byte);
      } else {
        if (current.length >= minLength) {
          strings.push(current);
        }
        current = '';
      }
    }

    if (current.length >= minLength) {
      strings.push(current);
    }

    return strings.slice(0, maxItems);
  }

  private buildXactDocProfileRecommendation(input: any) {
    if (input.textAnalysis.looksXmlLike || input.utf8Analysis.xmlMarkerCount > 0) {
      return 'XACTDOC appears XML-like in UTF-8. Next step: parse XML and extract rooms, sketches, dimensions, and line items.';
    }

    if (input.utf16LeAnalysis.xmlMarkerCount > 0) {
      return 'XACTDOC appears XML-like in UTF-16LE. Next step: decode as UTF-16LE and parse XML.';
    }

    if (input.nestedCompression.attempts?.gzip?.success) {
      return 'XACTDOC appears to contain nested gzip data. Next step: parse the gzip output profile.';
    }

    if (input.nestedCompression.attempts?.zlib?.success) {
      return 'XACTDOC appears to contain nested zlib data. Next step: parse the zlib output profile.';
    }

    if (input.nestedCompression.attempts?.rawDeflate?.success) {
      return 'XACTDOC can be raw-deflate inflated. Next step: inspect inflated output for XML or structured records.';
    }

    if (
      input.byteProfile.printableAsciiPercentage > 35 &&
      input.readableStrings.length > 0
    ) {
      return 'XACTDOC is partly readable but not XML. Next step: inspect extracted strings and identify Xactimate-specific record markers.';
    }

    if (input.byteProfile.entropy > 7.5) {
      return 'XACTDOC has high entropy and no XML markers. It may be encrypted, compressed with an unsupported method, or binary-packed. Next step: compare with additional ESX samples and identify container/version markers.';
    }

    return 'XACTDOC is binary-like and not XML-readable yet. Next step: build a binary marker map and compare against another ESX fixture.';
  }

  private classifyXactDocProfile(profile: any) {
    if (profile.textAnalysis.looksXmlLike) return 'readable-xml';
    if (profile.utf16LeAnalysis.xmlMarkerCount > 0) return 'utf16le-xml';
    if (profile.nestedCompression.attempts?.gzip?.success) return 'nested-gzip';
    if (profile.nestedCompression.attempts?.zlib?.success) return 'nested-zlib';
    if (profile.nestedCompression.attempts?.rawDeflate?.success) {
      return 'nested-raw-deflate';
    }
    if (profile.byteProfile.entropy > 7.5) return 'high-entropy-binary';
    if (
      profile.byteProfile.printableAsciiPercentage > 35 &&
      profile.readableStrings.length > 0
    ) {
      return 'partly-readable-binary';
    }

    return 'unknown-binary';
  }

  private bytesToSafeAscii(buffer: Buffer) {
    return Array.from(buffer)
      .map((byte) => {
        if (byte >= 32 && byte <= 126) return String.fromCharCode(byte);
        if (byte === 9) return '\\t';
        if (byte === 10) return '\\n';
        if (byte === 13) return '\\r';
        return '.';
      })
      .join('');
  }

  private calculateEntropy(counts: number[], total: number) {
    if (total <= 0) return 0;

    let entropy = 0;

    for (const count of counts) {
      if (count <= 0) continue;

      const probability = count / total;
      entropy -= probability * Math.log2(probability);
    }

    return Number(entropy.toFixed(4));
  }

  private percent(count: number, total: number) {
    if (total <= 0) return 0;
    return Number(((count / total) * 100).toFixed(4));
  }

  private decodeUtf16Be(buffer: Buffer) {
    const swapped = Buffer.alloc(buffer.length);

    for (let index = 0; index < buffer.length; index += 2) {
      swapped[index] = buffer[index + 1] ?? 0;
      swapped[index + 1] = buffer[index] ?? 0;
    }

    return swapped.toString('utf16le');
  }

  private getCompressionMethodLabel(method: number) {
    if (method === 0) return 'stored';
    if (method === 8) return 'deflate';
    return `unsupported-${method}`;
  }

  private toReferenceJobSummary(job: ReferenceJob) {
    return {
      id: job.id,
      name: job.name,
      sourceType: job.sourceType,
      projectLabel: job.projectLabel ?? null,
      panoCount: job.panoCount,
      cameraModel: job.cameraModel ?? null,
      captureDate: job.captureDate ?? null,
    };
  }
}