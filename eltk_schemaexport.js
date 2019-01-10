'use strict';

const e = React.createElement;

const groupsUrl = 'http://eltk.se/show_page.php?page=senior_gr_5137&operation=oth_grp';
const groupUrl = 'http://eltk.se/show_page.php?page=senior_gr_5137&action=save&operation=cntrl&kategori=gruppspel_8079&operation=oth_grp&group_id=';

const dateFormat = 'MM/DD/YYYY';
const timeFormat = 'hh:mm a';

const alertContainer = document.querySelector('#alert_container');
const alertTextContainer = document.querySelector('#alert_text_container');
const loaderIndicatorContainer = document.querySelector('#loader_indicator_container');

const loaderCssClass = 'spinner-loader';

const unselectableOption = -1;

class SchemaExporter extends React.Component {
  constructor(props) {
    super(props);
    this.state = { };
  }

  componentDidMount() {
    this.loadGroups();
  }

  render() {
    updateLoader(this.state.loading);
    return [
      e('div', {key:1, className: 'row'},
        e('div', {key: 1, className: 'col-sm', id: 'groupSelectContainer'}, this.selectElement()),
        e('div', {key: 2, className: 'col-sm'}, e(PlayerSelector, {selectedGroup: this.state.selected}))
      )
    ];
  }

  selectElement() {
    var groups = this.state.groups;
    var options = groups ? groups.map(group => e('option', {key: group.id, value: group.id }, group.name)) : [];
    options.unshift(e('option', {key: unselectableOption , value: unselectableOption, disabled: true }, 'Välj Grupp'));
    return e(
      'select',
      { defaultValue: unselectableOption, value: this.state.selected, onChange: this.changeHandler.bind(this), disabled: !groups },
      options);
  }

  loadGroups() {
    this.setState({ loading: true });
    return getWithCORS(groupsUrl)
      .then(response => this.setState({ groups: this.parseGroups(response.data), loading: false }))
      .catch(error => toggleAlert(error.message))
  }

  parseGroups(html) {
    return $('<div/>').append(withoutImgTags(html))
      .find('#sel_id')
      .find(':first-child')
      .children().get()
      .map(element => ({ id: element.value, name: element.text }));
  }

  changeHandler(event) {
    this.setState({selected : event.target.value })
  }

}

class PlayerSelector extends React.Component {

  constructor(props) {
    super(props);
    this.state = { };
  }

  componentDidUpdate(prevProps) {
    if (this.props.selectedGroup && this.props.selectedGroup !== prevProps.selectedGroup) {
      this.setState({ loading: true, selected: unselectableOption, fixtures: null });
      getWithCORS(groupUrl + this.props.selectedGroup)
        .then(response => this.setState({ fixtures: this.parseFixtures(response.data), loading: false }))
        .catch(error => toggleAlert(error.message))
    }
  }

  render() {
    if (this.props.selectedGroup) {
      updateLoader(this.state.loading);
    }
    return [
      e('div', {key: 1}, this.selectElement()),
      e('div', {key: 2}, this.exportButton())
    ];
  }

  parseFixtures(html) {
    var fixtureElements = $('<div/>').append(withoutImgTags(html)).find('td.pgcell').get();

    var fixtures = [];
    var i,j,temparray,chunk = 4;
    for (i=0,j=fixtureElements.length; i<j; i+=chunk) {
      fixtures.push(this.toFixture(fixtureElements.slice(i,i+chunk)));
    }
    return fixtures;
  }

  toFixture(fixtureElements) {
    var fixtureAnchor = $(fixtureElements[2]).find('a').get()[0];
    var startOfDate = fixtureAnchor.href.lastIndexOf('-') - 7;
    return {
      player1: this.toPlayer(fixtureElements[0]),
      player2: this.toPlayer(fixtureElements[1]),
      date: moment(fixtureAnchor.href.substring(startOfDate, startOfDate + 4) + ' ' + fixtureAnchor.text, 'YYYY DD MMM HH:mm'),
      court: fixtureElements[3].textContent.replace(/\r?\n|\r/g, '')
    };
  }

  toPlayer(fixtureElement) {
    return $(fixtureElement).find('a').get()[0].text;
  }

  selectElement() {
    var fixtures = this.state.fixtures;
    var options = fixtures ? [...this.getPlayers()].sort().map((fixture, index) => e('option', {key: index, value: fixture}, fixture)) : [];
    options.unshift(e('option', {key: unselectableOption , value: unselectableOption, disabled: true }, 'Välj Spelare'));
    return e('select', { defaultValue: unselectableOption, value: this.state.selected, onChange: this.changeHandler.bind(this), disabled: !fixtures }, options);
  }

  getPlayers() {
    var players = new Set([]);
    this.state.fixtures.forEach(fixture => players.add(fixture.player1).add(fixture.player2));
    return players;
  }

  exportButton() {
    return e(
      'button',
      { onClick: () => this.exportAndDownloadCsv(), disabled: !this.state.fixtures },
      'Exportera'
    );
  }

  exportAndDownloadCsv() {
    let csvContent = 'data:text/csv;charset=utf-8,';
    this.toRows().forEach(rowArray => csvContent += rowArray.join(',') + '\r\n');
    var encodedUri = encodeURI(csvContent);
    var link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'exporterat_schema_' + this.state.selected.replace(/\s/g, '_') + ".csv");
    document.body.appendChild(link);
    link.click();
  }

  getName() {
    return this.selected.name.replace(/\s/g, '');
  }

  toRows() {
    return this.state.fixtures.filter(fixture => fixture.player1 === this.state.selected || fixture.player2 === this.state.selected)
      .map(fixture => this.toRow(fixture));
  }

  toRow(fixture) {
    var row = [
      this.toDescription(fixture),
      fixture.date.format(dateFormat),
      fixture.date.format(timeFormat),
      fixture.date.format(dateFormat),
      fixture.date.add(1, 'hour').format(timeFormat),
      'False',
      this.toDescription(fixture),
      'Enskede Rackethall, Sockenvägen 290, 120 40 Årsta',
      'True'
    ];
    row.forEach((item, index, array) => array[index] = this.surroundWithQuotes(item));
    return row;
  }

  surroundWithQuotes(text) {
    return text.includes(' ') ? '"' + text + '"' : text;
  }

  toDescription(fixture) {
    return 'Match mellan ' + fixture.player1 + ' och ' + fixture.player2 + ' på bana ' + fixture.court;
  }

  changeHandler(event) {
    this.setState({selected : event.target.value })
  }

}

function updateLoader(loading) {
  if (loading) {
    removeAlertContainer();
    loaderIndicatorContainer.classList.add(loaderCssClass);
  } else {
    loaderIndicatorContainer.classList.remove(loaderCssClass);
  }
}

function removeAlertContainer() {
  alertContainer.style = 'display: none';
  alertTextContainer.innerHTML = '';
}

function toggleAlert(message) {
  updateLoader(false);
  alertContainer.style = '';
  alertTextContainer.innerHTML = message;
}

function getWithCORS(url) {
  return axios.get('https://cors-anywhere.herokuapp.com/' + url);
}

function withoutImgTags(html) {
   return html.replace(/<img[^>]*>/g,'');
}

ReactDOM.render(e(SchemaExporter), document.querySelector('#main_container'));