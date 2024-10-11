import React from 'react';
import { Typography, Tooltip, Box } from '@mui/material';

const HighlightedChanges = ({ text }) => {
    const parts = text.split(/(<add>.*?<\/add>|<del>.*?<\/del>)/);

    return (
        <Typography component="div">
            {parts.map((part, index) => {
                if (part.startsWith('<add>')) {
                    const content = part.replace(/<\/?add>/g, '');
                    return (
                        <Tooltip key={index} title="Přidaný text" arrow>
                            <Box
                                component="span"
                                sx={{
                                    backgroundColor: '#e6ffed',
                                    color: '#24292e',
                                    textDecoration: 'underline',
                                    textDecorationColor: '#28a745',
                                    textDecorationStyle: 'solid',
                                    textUnderlineOffset: '2px',
                                }}
                            >
                                {content}
                            </Box>
                        </Tooltip>
                    );
                } else if (part.startsWith('<del>')) {
                    const content = part.replace(/<\/?del>/g, '');
                    return (
                        <Tooltip key={index} title="Odstraněný text" arrow>
                            <Box
                                component="span"
                                sx={{
                                    backgroundColor: '#ffeef0',
                                    color: '#24292e',
                                    textDecoration: 'line-through',
                                    textDecorationColor: '#d73a49',
                                }}
                            >
                                {content}
                            </Box>
                        </Tooltip>
                    );
                } else {
                    return <span key={index}>{part}</span>;
                }
            })}
        </Typography>
    );
};

export default HighlightedChanges;