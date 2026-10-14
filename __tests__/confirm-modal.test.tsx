/**
 * `ConfirmModal` replaced `Alert.alert` for destructive confirmations, because
 * react-native-web stubs `Alert` out (`static alert() {}`) and the delete
 * button therefore did nothing in the browser. These tests pin the contract
 * the screens rely on: the dialog only acts on a deliberate confirm.
 */

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';

type Overrides = Partial<{
  visible: boolean;
  isBusy: boolean;
}>;

const renderModal = (overrides: Overrides = {}) => {
  const props = {
    visible: true,
    title: 'Delete habit?',
    message: 'Gone forever.',
    confirmLabel: 'Delete',
    busyLabel: 'Deleting…',
    isBusy: false,
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    ...overrides,
  };

  // React 19 renders concurrently: without `act` the tree would still be
  // mounting after the test finished, and the torn-down environment would
  // throw on the next lazy `react-native` import the theme hook performs.
  let tree!: ReactTestRenderer;

  act(() => {
    tree = create(<ConfirmModal {...props} />);
  });

  return { props, tree };
};

/** The rendered `Button` for a given label, so tests press what users press. */
const buttonByLabel = (tree: ReactTestRenderer, label: string) => {
  const button = tree.root.findAllByType(Button).find((node) => node.props.label === label);

  if (!button) {
    throw new Error(`No button labelled "${label}" was rendered.`);
  }

  return button;
};

describe('ConfirmModal', () => {
  it('renders nothing until it is visible', () => {
    const { tree } = renderModal({ visible: false });

    expect(tree.root.findAllByType(Button)).toHaveLength(0);
  });

  it('runs the action from the confirm button', () => {
    const { props, tree } = renderModal();

    buttonByLabel(tree, 'Delete').props.onPress();

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it('cancels without running the action', () => {
    const { props, tree } = renderModal();

    buttonByLabel(tree, 'Cancel').props.onPress();

    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('locks both buttons and shows the busy label while the action runs', () => {
    const { props, tree } = renderModal({ isBusy: true });

    // The confirming button must not offer a second tap while the delete is
    // in flight, and Cancel must not half-cancel it either.
    expect(buttonByLabel(tree, 'Cancel').props.disabled).toBe(true);

    const confirming = buttonByLabel(tree, 'Deleting…');

    expect(confirming.props.disabled).toBe(true);
    expect(confirming.props.onPress).toBe(props.onConfirm);
  });
});
