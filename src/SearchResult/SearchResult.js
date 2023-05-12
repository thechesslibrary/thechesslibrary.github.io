import WhitePawn from '../resources/pieces/With Shadow/256px/WP.png';
import BlackPawn from '../resources/pieces/With Shadow/256px/BP.png';
import Empty from '../resources/pieces/With Shadow/256px/WX.png';
import './SearchResult.css'

const SearchResult = ({ eventName, date, white, black, whiteTitle, blackTitle, whiteElo, blackElo, result, noves }) => {
    const bullet = <span className="bullet-point">&nbsp;&nbsp;•&nbsp;&nbsp;</span>
    return <>
        <div className="search-result">
            <p className="event-name text-primary text-uppercase fw-semibold" style={{display: 'block', padding: '0'}}>
                {eventName}{bullet}{date}{bullet}{result}</p>
            <div className="main-container">
                <div className="image-container  px-2">
                <img src={
                    result === '1-0' ? WhitePawn :
                    result === '0-1' ?  BlackPawn : 
                    Empty
                } alt={{result}} className="image"
                />
                </div>
                <div className="text-container px-1">
                    <h5>
                        <strong>{whiteTitle} </strong>
                        {white} ({whiteElo})
                    </h5>
                    <h5>
                        <strong>{blackTitle} </strong>
                        {black} ({blackElo})
                    </h5>
                </div>
            </div>
        </div>
    </>
}

export default SearchResult;