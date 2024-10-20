import { EditorState, StateEffect } from "@codemirror/state";

type FlashEffect = {
  from: number;
  to: number;
  shouldUpdateURL: boolean;
}
export const flashEffect = StateEffect.define<FlashEffect>();

// export type flashHandler = (code) => void;

export function flashAction(action = (str: string, shouldUpdateURL: boolean) => {}) {
  return EditorState.transactionExtender.of((tr) => {
    for (let effect of tr.effects) {
      if (effect.is(flashEffect)) {
        let { from, to, shouldUpdateURL } = effect.value;
        action(tr.newDoc.sliceString(from, to), shouldUpdateURL);
      }
    }

    return null;
  });
}
