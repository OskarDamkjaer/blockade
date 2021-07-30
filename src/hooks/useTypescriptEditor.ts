import { autocompletion } from "@codemirror/autocomplete";
import { javascript, javascriptLanguage } from "@codemirror/lang-javascript";
import { LanguageSupport, syntaxTree } from "@codemirror/language";
import { linter } from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { debounce } from "lodash-es";
import { useEffect } from "react";
import { logger } from "../logger";
import { useEditorAppearance } from "./useEditorAppearance";
import { useEditorBehaviour } from "./useEditorBehaviour";
import { useEditorKeymap } from "./useEditorKeymap";
import { useEditorParent } from "./useEditorParent";
import { useEditorTheme } from "./useEditorTheme";
import { FileMap, useTypescript } from "./useTypescript/useTypescript";

const log = logger("ts-editor", "skyblue");

export type { FileMap };

type EditorParams = {
  code: string;
  readonly?: boolean;
  types?: FileMap;
  onChange?: (value: string) => void;
  onExecuteQuery?: (value: string) => void;
};

/**
 * Creates a CodeMirror instance for editing TypeScript
 *
 * @param domSelector DOM Element where the editor will be rendered
 * @param params Editor configuration
 */
export function useTypescriptEditor(domSelector: string, params: EditorParams) {
  const ts = useTypescript(params.code, params.types);
  const updateFileDebounced = debounce((content: string) => {
    if (!ts) {
      log("ts is not initialized, skipping updateFile");
      return null;
    }

    log("Commit file change");
    ts.updateFile("index.ts", content);
  }, 100);

  const { parent, dimensions } = useEditorParent(domSelector);
  const editorTheme = useEditorTheme(dimensions);

  const appearanceExtensions = useEditorAppearance();
  const behaviourExtensions = useEditorBehaviour();
  const keyMapExtensions = useEditorKeymap();

  useEffect(() => {
    if (!ts) {
      log("ts is not initialized, deferring editor loading");
      return;
    }

    const view = new EditorView({
      parent,
      dispatch: transaction => {
        // Update view first
        view.update([transaction]);

        // Then tell tsserver about new file (on a debounce to avoid ddos-ing it)
        if (transaction.docChanged) {
          const newDoc = transaction.newDoc.sliceString(0);
          updateFileDebounced(newDoc);
          params.onChange?.(newDoc);
        }
      },
      state: EditorState.create({
        doc: params.code,

        extensions: [
          EditorView.editable.of(!params.readonly),
          javascript({ typescript: true, jsx: false }),
          autocompletion({
            activateOnTyping: true,
            override: [
              async ctx => {
                log("Autocomplete requested", { pos: ctx.pos });

                const completions = ts.languageService.getCompletionsAtPosition(
                  "index.ts",
                  ctx.pos,
                  {}
                );
                if (!completions) {
                  log("Unable to get completions", { pos: ctx.pos });
                  return null;
                }

                return {
                  from: ctx.pos,
                  options:
                    completions.entries.map(c => ({
                      type: "property", // TODO:: Return correct `type`
                      label: c.name,
                      // info:
                      //   c.displayParts.map(p => p.text).join("") +
                      //   (c.documentation || ""),
                    })) || [],
                };
              },
            ],
          }),
          linter(() =>
            ts.languageService.getSemanticDiagnostics("index.ts").map(d => ({
              from: d.start || 0,
              to: (d.start || 0) + (d.length || 0),
              severity: "error",
              message: d.messageText as string,
            }))
          ),

          editorTheme,
          ...appearanceExtensions,
          ...behaviourExtensions,
          ...keyMapExtensions,

          keymap.of([
            {
              key: "Ctrl-Enter",
              mac: "Mod-Enter",
              run: ({ state }) => {
                log("Running query (unsupported)");

                return true;
              },
            },
          ]),
        ],
      }),
    });

    log("Initialized");

    return () => {
      view.destroy();
    };
  }, [ts]);
}
