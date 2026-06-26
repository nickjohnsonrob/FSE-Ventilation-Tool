import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { MethodSwitcher } from './MethodSwitcher';
import type { CalcMethod } from './MethodSwitcher';
import type { SimplifiedMethod } from '../lib/tables';

function MethodSwitcherStory(props: {
  method: CalcMethod;
  simplifiedMethod: SimplifiedMethod;
  onChange: (m: CalcMethod) => void;
  onSimplifiedMethodChange: (sm: SimplifiedMethod) => void;
}): JSX.Element {
  const [method, setMethod] = useState<CalcMethod>(props.method);
  const [simplifiedMethod, setSimplifiedMethod] =
    useState<SimplifiedMethod>(props.simplifiedMethod);
  return (
    <MethodSwitcher
      method={method}
      simplifiedMethod={simplifiedMethod}
      onChange={(m) => {
        setMethod(m);
        props.onChange(m);
      }}
      onSimplifiedMethodChange={(s) => {
        setSimplifiedMethod(s);
        props.onSimplifiedMethodChange(s);
      }}
    />
  );
}

const meta = {
  title: 'Components/MethodSwitcher',
  component: MethodSwitcher,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    onChange: () => {},
    onSimplifiedMethodChange: () => {},
  },
  render: (args) => <MethodSwitcherStory {...args} />,
} satisfies Meta<typeof MethodSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AppendixA: Story = {
  args: { method: 'appendixA', simplifiedMethod: 'table6-3' },
};

export const Simplified: Story = {
  args: { method: 'simplified', simplifiedMethod: 'table6-3' },
};

export const SimplifiedWithEq678: Story = {
  args: { method: 'simplified', simplifiedMethod: 'eq6-7-6-8' },
};