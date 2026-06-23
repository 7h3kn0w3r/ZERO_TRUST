import satori from 'satori';
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fontsDir = join(process.cwd(), 'public', 'fonts');

let interFont: ArrayBuffer | null = null;
let orbitronFont: ArrayBuffer | null = null;

function loadFonts() {
  if (!interFont) {
    interFont = readFileSync(join(fontsDir, 'inter-700.woff')).buffer;
  }
  if (!orbitronFont) {
    orbitronFont = readFileSync(join(fontsDir, 'orbitron-700.woff')).buffer;
  }
}

interface OgImageOptions {
  title: string;
  description: string;
  category: string;
  date: string;
}

export async function generateOgImage(options: OgImageOptions): Promise<Buffer> {
  loadFonts();

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#0B0B0F',
          padding: '64px',
          fontFamily: 'Inter',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      color: '#B3001B',
                      fontSize: '20px',
                      fontFamily: 'Orbitron',
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                    },
                    children: 'Noir Trace // Writeup',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      color: '#FFFFFF',
                      fontSize: '52px',
                      fontFamily: 'Orbitron',
                      lineHeight: 1.15,
                      maxWidth: '1000px',
                    },
                    children: options.title,
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      color: '#A8A8A8',
                      fontSize: '24px',
                      lineHeight: 1.4,
                      maxWidth: '900px',
                    },
                    children: options.description.slice(0, 140),
                  },
                },
              ],
            },
          },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '2px solid #1F1F2E',
                paddingTop: '24px',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      color: '#B3001B',
                      fontSize: '18px',
                      fontFamily: 'Orbitron',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                    },
                    children: options.category,
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      color: '#A8A8A8',
                      fontSize: '18px',
                    },
                    children: options.date,
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Inter',
          data: interFont!,
          weight: 700,
          style: 'normal',
        },
        {
          name: 'Orbitron',
          data: orbitronFont!,
          weight: 700,
          style: 'normal',
        },
      ],
    },
  );

  return sharp(Buffer.from(svg)).png().toBuffer();
}
