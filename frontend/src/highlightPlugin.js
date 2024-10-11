import { Modifier, EditorState, SelectionState } from 'draft-js';

const createHighlightPlugin = () => {
    return {
        customStyleMap: {
            HIGHLIGHT: {
                background: 'yellow',
            },
        },
        onChange: (editorState) => {
            const selection = editorState.getSelection();
            if (selection.isCollapsed()) {
                return editorState;
            }

            const content = editorState.getCurrentContent();
            const nextContent = Modifier.applyInlineStyle(
                content,
                selection,
                'HIGHLIGHT'
            );

            return EditorState.push(editorState, nextContent, 'change-inline-style');
        },
    };
};

export default createHighlightPlugin;