import type { Preview } from '@storybook/react';
import '../src/styles/index.css';
import React from 'react';

const preview: Preview = {
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#f5f7f9' },
        { name: 'dark', value: '#15171c' },
      ],
    },
  },
  decorators: [
    (Story, ctx) => {
      const theme = (ctx.globals.theme as string) || 'light';
      return React.createElement('div', { 'data-theme': theme }, Story());
    },
  ],
};

export default preview;
