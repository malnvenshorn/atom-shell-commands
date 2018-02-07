( function( module ) {
	module.exports = {
		configurationFilePath: {
			type: 'string',
			default: atom.getConfigDirPath(),
		},
		projectConfigurationFilePath: {
			type: 'string',
			default: '.',
		},
	}
} )( module );
