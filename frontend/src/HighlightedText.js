import React, { useState, useCallback } from 'react';
import {
    AppBar, Toolbar, Typography, IconButton, Box, Button, CircularProgress,
    Container
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { EditorState, ContentState, CompositeDecorator, Modifier } from 'draft-js';
import Editor from '@draft-js-plugins/editor';

const Root = styled('div')(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    width: '100%',
}));

const StyledAppBar = styled(AppBar)(({ theme }) => ({
    position: 'relative',
}));

const EditorWrapper = styled(Box)(({ theme }) => ({
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2),
    minHeight: '300px',
    marginBottom: theme.spacing(2),
}));

// Komponenty pro zvýraznění textu
const AddedSpan = styled('span')({
    backgroundColor: '#e6ffed',
    textDecoration: 'underline',
});

const DeletedSpan = styled('span')({
    backgroundColor: '#ffeef0',
    textDecoration: 'line-through',
});

const ChangedSpan = styled('span')({
    backgroundColor: '#fff9c4',
    textDecoration: 'underline',
    textDecorationStyle: 'wavy',
    textDecorationColor: '#fdd835',
});

// Funkce pro nalezení entit v textu
const findEntities = (contentBlock, callback, contentState, entityType) => {
    contentBlock.findEntityRanges(
        (character) => {
            const entityKey = character.getEntity();
            return (
                entityKey !== null &&
                contentState.getEntity(entityKey).getType() === entityType
            );
        },
        callback
    );
};

// Komponenty pro renderování entit
const AddedSpanComponent = (props) => {
    return <AddedSpan>{props.children}</AddedSpan>;
};

const DeletedSpanComponent = (props) => {
    return <DeletedSpan>{props.children}</DeletedSpan>;
};

const ChangedSpanComponent = (props) => {
    const entity = props.contentState.getEntity(props.entityKey);
    const { original } = entity.getData();
    return (
        <ChangedSpan title={`Původně: "${original}"`}>
            {props.children}
        </ChangedSpan>
    );
};

// Vytvoření dekorátoru
const decorator = new CompositeDecorator([
    {
        strategy: (contentBlock, callback, contentState) =>
            findEntities(contentBlock, callback, contentState, 'ADDED'),
        component: AddedSpanComponent,
    },
    {
        strategy: (contentBlock, callback, contentState) =>
            findEntities(contentBlock, callback, contentState, 'DELETED'),
        component: DeletedSpanComponent,
    },
    {
        strategy: (contentBlock, callback, contentState) =>
            findEntities(contentBlock, callback, contentState, 'CHANGED'),
        component: ChangedSpanComponent,
    },
]);

const TextChecker = ({ onBack }) => {
    const [editorState, setEditorState] = useState(
        EditorState.createEmpty(decorator)
    );
    const [loading, setLoading] = useState(false);

    const handleCheck = async () => {
        setLoading(true);
        try {
            const contentState = editorState.getCurrentContent();
            const text = contentState.getPlainText();

            const response = await fetch('/analyze_text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    assistant_id: 'asst_G03yKtujHGxoTScgMTTlRMrH'
                }),
            });

            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();

            const newContentState = processAnalyzedText(data.improved_text);
            setEditorState(EditorState.createWithContent(newContentState, decorator));
        } catch (error) {
            console.error('Error during text analysis:', error);
        } finally {
            setLoading(false);
        }
    };

    const processAnalyzedText = (analyzedText) => {
        let contentState = ContentState.createFromText(analyzedText.replace(/<[^>]+>/g, ''));
        const regex = /<(add|del|change[^>]*)>(.*?)<\/\1>/g;
        let match;
        let lastIndex = 0;

        while ((match = regex.exec(analyzedText)) !== null) {
            const [fullMatch, type, content] = match;
            const start = analyzedText.slice(0, match.index).replace(/<[^>]+>/g, '').length;
            const end = start + content.length;

            let entityType;
            let entityData = {};

            switch (type) {
                case 'add':
                    entityType = 'ADDED';
                    break;
                case 'del':
                    entityType = 'DELETED';
                    break;
                case 'change':
                    entityType = 'CHANGED';
                    const originalMatch = type.match(/original="([^"]*)"/);
                    if (originalMatch) {
                        entityData.original = originalMatch[1];
                    }
                    break;
            }

            contentState = contentState.createEntity(entityType, 'MUTABLE', entityData);
            const entityKey = contentState.getLastCreatedEntityKey();

            contentState = Modifier.applyEntity(
                contentState,
                contentState.getSelectionAfter().merge({
                    anchorOffset: start,
                    focusOffset: end,
                }),
                entityKey
            );

            lastIndex = match.index + fullMatch.length;
        }

        return contentState;
    };

    return (
        <Root>
            <StyledAppBar>
                <Toolbar>
                    <IconButton edge="start" color="inherit" onClick={onBack} aria-label="back">
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        Kontrola textu
                    </Typography>
                </Toolbar>
            </StyledAppBar>
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <EditorWrapper>
                    <Editor
                        editorState={editorState}
                        onChange={setEditorState}
                    />
                </EditorWrapper>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Button
                        variant="contained"
                        onClick={handleCheck}
                        disabled={loading || !editorState.getCurrentContent().hasText()}
                    >
                        {loading ? <CircularProgress size={24} /> : 'Zkontrolovat text'}
                    </Button>
                </Box>
            </Container>
        </Root>
    );
};

export default TextChecker;