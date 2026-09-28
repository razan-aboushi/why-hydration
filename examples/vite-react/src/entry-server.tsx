import { renderToString } from 'react-dom/server';
import App, { scenarioFrom } from './App';

export function render(url: string): string {
  return renderToString(<App scenario={scenarioFrom(url)} />);
}
