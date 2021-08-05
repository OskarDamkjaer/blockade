import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { logger } from "../logger";
import { behaviour } from "./extensions/behaviour";
import { keymap } from "./extensions/keymap";
import { setTheme, theme, ThemeName } from "./extensions/theme";

const log = logger("json-editor", "salmon");

type EditorParams = {
  domElement: Element;
  code: string;
  readonly?: boolean;
  theme?: ThemeName;
  onChange?: (value: string) => void;
};

export class Editor {
  private view: EditorView;

  constructor(params: EditorParams) {
    this.view = new EditorView({
      parent: params.domElement,
      dispatch: transaction => {
        // Update view first
        this.view.update([transaction]);

        if (transaction.docChanged) {
          params.onChange?.(transaction.newDoc.sliceString(0));
        }
      },
      state: EditorState.create({
        doc: params.code,

        extensions: [
          EditorView.editable.of(!params.readonly),
          json(),
          linter(jsonParseLinter()),

          theme("light"),
          behaviour,
          keymap,
        ],
      }),
    });

    log("Initialized");
  }

  public setTheme(theme: ThemeName) {
    this.view.dispatch(setTheme(theme));
  }

  public forceUpdate = (code: string) => {
    log("Force updating editor value");

    this.view.dispatch({
      changes: [
        { from: 0, to: this.view.state.doc.length },
        { from: 0, insert: code },
      ],
    });
  };

  public destroy = () => {
    this.view.destroy();
  };
}
