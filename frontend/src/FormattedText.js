import React from 'react';
import { Typography, Tooltip } from '@mui/material';

const FormattedText = ({ text }) => {
    const renderFormattedText = () => {
        // Rozdělíme text na části podle XML značek
        const parts = text.split(/(<\/?[^>]+>)/);
        let isDeleted = false;
        let changeOriginal = '';

        return parts.map((part, index) => {
            if (part.startsWith('<del>')) {
                isDeleted = true;
                return null;
            } else if (part.startsWith('</del>')) {
                isDeleted = false;
                return null;
            } else if (part.startsWith('<change')) {
                const match = part.match(/original="([^"]*)"/);
                if (match) {
                    changeOriginal = match[1];
                }
                return null;
            } else if (part.startsWith('</change>')) {
                changeOriginal = '';
                return null;
            } else if (!part.startsWith('<') && !part.startsWith('>')) {
                // Toto je textový obsah
                let style = {};
                let tooltipTitle = '';

                if (isDeleted) {
                    style = {
                        backgroundColor: '#ffeef0',
                        textDecoration: 'line-through',
                        textDecorationColor: '#d73a49'
                    };
                    tooltipTitle = 'Odstraněný text';
                } else if (changeOriginal) {
                    style = {
                        backgroundColor: '#fff9c4',
                        textDecoration: 'underline',
                        textDecorationStyle: 'wavy',
                        textDecorationColor: '#fdd835'
                    };
                    tooltipTitle = `Původně: "${changeOriginal}"`;
                }

                return (
                    <Tooltip key={index} title={tooltipTitle} arrow>
                        <span style={style}>
                            {part}
                        </span>
                    </Tooltip>
                );
            }
            return null;
        }).filter(Boolean); // Odstraníme null hodnoty
    };

    return <Typography component="div">{renderFormattedText()}</Typography>;
};

export default FormattedText;