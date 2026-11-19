import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DISEASE_VIDEOS,
  findDiseaseVideo,
  formatDiseaseVideoMessage,
  parseDiseaseVideoCsv,
  formatDiseaseVideosForPrompt,
  normalizeCategoryName,
} from './disease-video-links';

describe('disease-video-links', () => {
  it('contains all 12 default diseases with rich Hindi guidance', () => {
    expect(DEFAULT_DISEASE_VIDEOS.length).toBeGreaterThanOrEqual(12);

    const categories = DEFAULT_DISEASE_VIDEOS.map((d) => d.category);
    expect(categories).toContain('pcod_pcos');
    expect(categories).toContain('infertility_conceive');
    expect(categories).toContain('male_infertility');
    expect(categories).toContain('tubal_blockage');
    expect(categories).toContain('white_discharge');
    expect(categories).toContain('fibroids');
    expect(categories).toContain('low_amh');
    expect(categories).toContain('periods');
    expect(categories).toContain('endometriosis');
    expect(categories).toContain('unexplained_infertility');
    expect(categories).toContain('menopause');
    expect(categories).toContain('intro');
  });

  it('correctly finds matching disease videos from chat/concern text', () => {
    const tubal = findDiseaseVideo('meri tubal block hai report me');
    expect(tubal).toBeDefined();
    expect(tubal?.category).toBe('tubal_blockage');
    expect(tubal?.youtubeUrl).toContain('DaGu2ZeSuBg');

    const pcod = findDiseaseVideo('PCOD ki dawa bataiye periods nahi aa rahe');
    expect(pcod).toBeDefined();
    expect(pcod?.category).toBe('pcod_pcos');
    expect(pcod?.youtubeUrl).toContain('SIwdLPiapGk');

    const sperm = findDiseaseVideo('husband ka sperm count low hai');
    expect(sperm).toBeDefined();
    expect(sperm?.category).toBe('male_infertility');
    expect(sperm?.youtubeUrl).toContain('VGrD6z4djQk');

    const fibroid = findDiseaseVideo('uterus me rasouli fibroid bataya hai');
    expect(fibroid).toBeDefined();
    expect(fibroid?.category).toBe('fibroids');
    expect(fibroid?.youtubeUrl).toContain('JIpdhitZqCk');

    const endometriosis = findDiseaseVideo('endimetriosis and chocolate cyst problem');
    expect(endometriosis).toBeDefined();
    expect(endometriosis?.category).toBe('endometriosis');
    expect(endometriosis?.youtubeUrl).toContain('w5VIHXn02JY');
  });

  it('parses user-provided CSV rows accurately and updates URLs', () => {
    const csvInput = `
PCOD/PCOS,https://www.youtube.com/watch?v=SIwdLPiapGk
Infertility,https://youtu.be/Ff7-H4rdh34?si=CITpPFdi14bDEp_l
Sperm Issues,https://www.youtube.com/shorts/VGrD6z4djQk
Tubal Blockage,https://www.youtube.com/watch?v=DaGu2ZeSuBg
White Discharge,https://www.youtube.com/shorts/IDx6reRUI_o
Fibroids,https://www.youtube.com/shorts/JIpdhitZqCk
Low AMH,https://www.youtube.com/watch?v=-OnxJRJReQ8
Periods,https://www.youtube.com/watch?v=dMkrUxILiqQ
Menopause Care,
Endimetriosis,https://www.youtube.com/watch?v=w5VIHXn02JY
Unexplained Infertility,https://www.youtube.com/watch?v=JeDkcmN5SBI
INTRO,https://www.instagram.com/p/DfbeKSXqOhN/
    `.trim();

    const parsed = parseDiseaseVideoCsv(csvInput);
    expect(parsed.length).toBeGreaterThanOrEqual(12);

    const pcod = parsed.find((p) => p.category === 'pcod_pcos');
    expect(pcod?.youtubeUrl).toBe('https://www.youtube.com/watch?v=SIwdLPiapGk');

    const infertility = parsed.find((p) => p.category === 'infertility_conceive');
    expect(infertility?.youtubeUrl).toBe('https://youtu.be/Ff7-H4rdh34?si=CITpPFdi14bDEp_l');

    const fibroids = parsed.find((p) => p.category === 'fibroids');
    expect(fibroids?.youtubeUrl).toBe('https://www.youtube.com/shorts/JIpdhitZqCk');

    const endo = parsed.find((p) => p.category === 'endometriosis');
    expect(endo?.youtubeUrl).toBe('https://www.youtube.com/watch?v=w5VIHXn02JY');

    const unexplained = parsed.find((p) => p.category === 'unexplained_infertility');
    expect(unexplained?.youtubeUrl).toBe('https://www.youtube.com/watch?v=JeDkcmN5SBI');

    const intro = parsed.find((p) => p.category === 'intro');
    expect(intro?.youtubeUrl).toBe('https://www.instagram.com/p/DfbeKSXqOhN/');
  });

  it('formats prompt directives and message recommendations properly', () => {
    const promptSection = formatDiseaseVideosForPrompt();
    expect(promptSection).toContain('OFFICIAL EDUCATIONAL VIDEO LINKS');
    expect(promptSection).toContain('https://www.youtube.com/watch?v=SIwdLPiapGk');

    const pcod = DEFAULT_DISEASE_VIDEOS[0];
    const msg = formatDiseaseVideoMessage(pcod);
    expect(msg).toContain('PCOD');
    expect(msg).toContain('https://www.youtube.com/watch?v=SIwdLPiapGk');
  });

  it('normalizes category names from user input', () => {
    expect(normalizeCategoryName('PCOD/PCOS')).toBe('pcod_pcos');
    expect(normalizeCategoryName('Sperm Issues')).toBe('male_infertility');
    expect(normalizeCategoryName('Endimetriosis')).toBe('endometriosis');
    expect(normalizeCategoryName('Tubal Blockage')).toBe('tubal_blockage');
  });
});
