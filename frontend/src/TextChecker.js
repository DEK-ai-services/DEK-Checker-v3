import React, { useState, useCallback } from 'react';
import {
    AppBar, Toolbar, Typography, IconButton, Box, Button, CircularProgress,
    Container, Grid, Paper, Card, CardContent, Chip
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { EditorState, ContentState, Modifier } from 'draft-js';
import Editor from '@draft-js-plugins/editor';
import FormattedText from './FormattedText';

const Root = styled('div')(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    width: '100%',
}));

const StyledAppBar = styled(AppBar)(({ theme }) => ({
    position: 'relative',
}));

const EditorWrapper = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(2),
    minHeight: '500px',
    marginBottom: theme.spacing(2),
}));

const FormattedTextWrapper = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(2),
    minHeight: '500px',
    marginBottom: theme.spacing(2),
    overflowY: 'auto',
}));

const ChangeChip = styled(Chip)(({ theme }) => ({
    margin: theme.spacing(0.5),
}));

const TextChecker = ({ onBack }) => {
    const [editorState, setEditorState] = useState(EditorState.createEmpty());
    const [loading, setLoading] = useState(false);
    const [gptResponse, setGptResponse] = useState('');
    const [suggestions, setSuggestions] = useState([]);

    const handleEditorChange = useCallback((newEditorState) => {
        setEditorState(newEditorState);
    }, []);

    const extractSuggestions = (text) => {
        console.log('Extracting suggestions from:', text);
        const regex = /<change original="([^"]+)">([^<]+)<\/change>/g;
        let match;
        const extractedSuggestions = [];

        while ((match = regex.exec(text)) !== null) {
            console.log('Found match:', match);
            const [fullMatch, original, suggested] = match;
            if (original !== suggested) {
                extractedSuggestions.push({
                    type: 'change',
                    original: original,
                    suggested: suggested
                });
            }
        }

        console.log('Extracted suggestions:', extractedSuggestions);
        return extractedSuggestions;
    };

    const handleCheck = useCallback(async () => {
        setLoading(true);
        try {
            const contentState = editorState.getCurrentContent();
            const text = contentState.getPlainText();

            console.log('Sending text for analysis:', text);

            const response = await fetch('/analyze_text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    assistant_id: 'asst_G03yKtujHGxoTScgMTTlRMrH'
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Network response was not ok: ${errorText}`);
            }

            const data = await response.json();

            console.log('GPT Response:', data);
            if (!data.improved_text) {
                throw new Error('Improved text is missing from the response');
            }

            setGptResponse(data.improved_text);
            const extractedSuggestions = extractSuggestions(data.improved_text);
            console.log('Extracted suggestions:', extractedSuggestions);
            setSuggestions(extractedSuggestions);
        } catch (error) {
            console.error('Error during text analysis:', error);
            setGptResponse(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }, [editorState]);

    const handleAcceptSuggestion = (suggestion) => {
        const contentState = editorState.getCurrentContent();
        const blockMap = contentState.getBlockMap();

        let newContentState = contentState;

        blockMap.forEach((block) => {
            const text = block.getText();
            const start = text.indexOf(suggestion.original);
            if (start >= 0) {
                const end = start + suggestion.original.length;
                const selection = newContentState.getSelectionAfter().merge({
                    anchorOffset: start,
                    focusOffset: end,
                    anchorKey: block.getKey(),
                    focusKey: block.getKey(),
                });

                newContentState = Modifier.replaceText(
                    newContentState,
                    selection,
                    suggestion.suggested
                );
            }
        });

        const newEditorState = EditorState.push(editorState, newContentState, 'apply-suggestion');
        setEditorState(newEditorState);
        setSuggestions(suggestions.filter(s => s !== suggestion));
    };

    const handleRejectSuggestion = (suggestion) => {
        setSuggestions(suggestions.filter(s => s !== suggestion));
    };

    const renderSuggestions = () => {
        if (suggestions.length === 0) {
            return (
                <Typography color="textSecondary">
                    Žádné návrhy změn k dispozici.
                </Typography>
            );
        }

        return (
            <Card variant="outlined">
                <CardContent>
                    <Typography variant="h6" gutterBottom>Návrh opravy:</Typography>
                    {suggestions.map((suggestion, index) => (
                        <ChangeChip
                            key={index}
                            label={`${suggestion.original} → ${suggestion.suggested}`}
                            color="primary"
                            variant="outlined"
                            onDelete={() => handleRejectSuggestion(suggestion)}
                            onClick={() => handleAcceptSuggestion(suggestion)}
                        />
                    ))}
                </CardContent>
            </Card>
        );
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
            <Container maxWidth="xl" sx={{ mt: 4 }}>
                <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                        <EditorWrapper>
                            <Typography variant="h6" gutterBottom>Editor</Typography>
                            <Editor
                                editorState={editorState}
                                onChange={handleEditorChange}
                            />
                        </EditorWrapper>
                        <Button
                            variant="contained"
                            onClick={handleCheck}
                            disabled={loading || !editorState.getCurrentContent().hasText()}
                            sx={{ mt: 2 }}
                        >
                            {loading ? <CircularProgress size={24} /> : 'Zkontrolovat text'}
                        </Button>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <FormattedTextWrapper>
                            <Typography variant="h6" gutterBottom>Analýza GPT</Typography>
                            {gptResponse ? (
                                <>
                                    {renderSuggestions()}
                                    <Box mt={2}>
                                        <FormattedText text={gptResponse} />
                                    </Box>
                                </>
                            ) : (
                                <Typography color="textSecondary">
                                    Zde se zobrazí analýza textu po kliknutí na tlačítko "Zkontrolovat text".
                                </Typography>
                            )}
                        </FormattedTextWrapper>
                    </Grid>
                </Grid>
            </Container>
        </Root>
    );
};

export default TextChecker;