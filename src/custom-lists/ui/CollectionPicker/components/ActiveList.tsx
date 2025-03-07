import styled from 'styled-components'
import { fontSizeSmall } from 'src/common-ui/components/design-library/typography'

export const ActiveList = styled.div`
    align-items: center;
    border-radius: 4px;
    color: ${(props) => props.theme.colors.normalText};
    font-size: ${fontSizeSmall}px;
    font-weight: 400;
    padding: 2px 8px;
    margin: 2px 4px 2px 0;
    transition: background 0.3s;
    word-break: break-word;

    &:hover {
        cursor: pointer;
        background-color: #dadada;
    }
`
