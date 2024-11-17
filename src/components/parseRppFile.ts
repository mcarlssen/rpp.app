import { Clip } from '../types';

export async function parseRppFile(input: File | string, verbose: boolean): Promise<Clip[]> {
  let data: string;

  if (typeof input === 'string') {
    // Input is a string containing the file content
    data = input;
  } else {
    // Input is a File object
    data = await input.text();
  }

  const lines = data.split('\n');
  const clips: Clip[] = [];
  let currentClip: Partial<Clip> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('<ITEM')) {
      currentClip = {};
    } else if (line.startsWith('IGUID')) {
      currentClip.IGUID = line.split(' ')[1];
    } else if (line.startsWith('POSITION')) {
      currentClip.POSITION = parseFloat(line.split(' ')[1]);
    } else if (line.startsWith('LENGTH')) {
      currentClip.LENGTH = parseFloat(line.split(' ')[1]);
    } else if (line.startsWith('SOFFS')) {
      currentClip.OFFSET = parseFloat(line.split(' ')[1]);
    } else if (line.startsWith('>')) {
      if (currentClip.IGUID && currentClip.POSITION !== undefined && currentClip.LENGTH !== undefined) {
        clips.push(currentClip as Clip);
      }
    }
  }

  const uniqueClips = clips.reduce((acc, current) => {
    const x = acc.find(item => item.IGUID === current.IGUID);
    if (!x) {
      return acc.concat([current]);
    } else {
      return acc;
    }
  }, [] as Clip[]);

  verbose && console.log('Parsed Clips (unique):', uniqueClips);

  return uniqueClips;
} 