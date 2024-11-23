import { TOLERANCE } from '../constants'

interface Clip {
  POSITION: number;
  LENGTH: number;
  OFFSET?: number;
  NAME: string;
  IGUID: string;
}

interface Change {
  position: number;
  type: 'changed' | 'added' | 'deleted';
  originalPosition?: number;
}

export async function parseRppFile(file: File, verbose: boolean): Promise<Clip[]> {
  const data = await file.text();
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

function compareClips(
  controlClip: Clip, 
  revisedClip: Clip, 
  cumulativeShift: number,
): boolean {
  //const TOLERANCE = 0.001; // 1 millisecond tolerance
  const expectedPosition = controlClip.POSITION + cumulativeShift;
  const positionDiff = Math.abs(revisedClip.POSITION - expectedPosition);
  const lengthDiff = Math.abs(revisedClip.LENGTH - controlClip.LENGTH);
  
  // Return true if either position or length has changed beyond tolerance
  return positionDiff > TOLERANCE || lengthDiff > TOLERANCE;
}

function detectOverlaps(clips: Clip[]): number[] {
  const overlapPositions: number[] = [];
  
  for (let i = 0; i < clips.length - 1; i++) {
    const currentClip = clips[i];
    const nextClip = clips[i + 1];
    const currentEnd = currentClip.POSITION + currentClip.LENGTH;
    
    if (currentEnd > nextClip.POSITION) {
      overlapPositions.push(currentClip.POSITION);
    }
  }
  
  return overlapPositions;
}

export async function detectChanges(
  controlFile: File, 
  revisedFile: File, 
  verbose: boolean
): Promise<{
  changedPositions: number[],
  controlClips: Clip[],
  revisedClips: Clip[],
  changes: Change[]
}> {
  const controlClips = await parseRppFile(controlFile, verbose);
  const revisedClips = await parseRppFile(revisedFile, verbose);
  const changes: Change[] = [];
  
  let cumulativeShift = 0;
  
  // First pass: detect changed and deleted clips
  controlClips.forEach(controlClip => {
    const revisedClip = revisedClips.find(r => r.IGUID === controlClip.IGUID);
    
    if (!revisedClip) {
      // Clip exists in control but not in revised -> deleted
      changes.push({
        position: controlClip.POSITION,
        type: 'deleted',
        originalPosition: controlClip.POSITION
      });
    } else if (compareClips(controlClip, revisedClip, cumulativeShift)) {
      // Clip exists in both but has changed
      changes.push({
        position: revisedClip.POSITION,
        type: 'changed',
        originalPosition: controlClip.POSITION
      });
      
      // Update cumulative shift
      cumulativeShift += (revisedClip.LENGTH - controlClip.LENGTH);
    }
  });
  
  // Second pass: detect added clips
  revisedClips.forEach(revisedClip => {
    const controlClip = controlClips.find(c => c.IGUID === revisedClip.IGUID);
    if (!controlClip) {
      // Clip exists in revised but not in control -> added
      changes.push({
        position: revisedClip.POSITION,
        type: 'added'
      });
    }
  });

  verbose && console.log('Detected changes:', {
    changes,
    cumulativeShift,
    overlaps: detectOverlaps(revisedClips)
  });

  return {
    changedPositions: changes.map(change => change.position),
    controlClips,
    revisedClips,
    changes
  };
} 