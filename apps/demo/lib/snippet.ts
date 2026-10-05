import type { CustomTheme, SoundOption, ThemeName } from 'clacky';

export interface SnippetSettings {
  username: string;
  theme: ThemeName;
  customLevels: string[] | null;
  colorScheme: 'light' | 'dark';
  sound: SoundOption;
  volume: number;
  muted: boolean;
  ghostTyping: boolean;
}

function themeValue(s: SnippetSettings): ThemeName | CustomTheme {
  return s.customLevels ? { extends: s.theme, levels: s.customLevels } : s.theme;
}

/** Only props that differ from the library defaults make it into the snippet. */
export function reactSnippet(s: SnippetSettings): string {
  const props: string[] = [`username="${s.username}"`];
  const theme = themeValue(s);
  if (typeof theme === 'string') {
    if (theme !== 'github') props.push(`theme="${theme}"`);
  } else {
    props.push(
      `theme={{\n        extends: '${theme.extends}',\n        levels: [${theme.levels!.map((c) => `'${c}'`).join(', ')}],\n      }}`,
    );
  }
  if (s.colorScheme !== 'light') props.push(`colorScheme="${s.colorScheme}"`);
  if (s.sound === false) props.push('sound={false}');
  else if (s.sound !== 'brown') props.push(`sound="${String(s.sound)}"`);
  if (s.sound !== false && s.volume !== 0.5) props.push(`volume={${s.volume}}`);
  if (s.muted) props.push('muted');
  props.push('yearSelector');
  if (s.ghostTyping) props.push('ghostTyping');

  return `import { Clacky } from 'clacky/react';

export function Contributions() {
  return (
    <Clacky
      ${props.join('\n      ')}
      onKeyPress={(day) => console.log(day.date, day.count)}
    />
  );
}`;
}

export function htmlSnippet(s: SnippetSettings): string {
  const attrs: string[] = [`username="${s.username}"`];
  const theme = themeValue(s);
  if (typeof theme === 'string') {
    if (theme !== 'github') attrs.push(`theme="${theme}"`);
  } else {
    attrs.push(`theme='${JSON.stringify(theme)}'`);
  }
  if (s.colorScheme !== 'light') attrs.push(`color-scheme="${s.colorScheme}"`);
  if (s.sound === false) attrs.push('sound="off"');
  else if (s.sound !== 'brown') attrs.push(`sound="${String(s.sound)}"`);
  if (s.sound !== false && s.volume !== 0.5) attrs.push(`volume="${s.volume}"`);
  if (s.muted) attrs.push('muted');
  attrs.push('year-selector');
  if (s.ghostTyping) attrs.push('ghost-typing');

  return `<script src="https://unpkg.com/clacky/dist/clacky.iife.js"></script>

<clacky-graph
  ${attrs.join('\n  ')}
></clacky-graph>

<script>
  document.querySelector('clacky-graph')
    .addEventListener('clacky-keypress', (e) => console.log(e.detail));
</script>`;
}

export const INSTALL_COMMAND = 'npm install clacky motion';
