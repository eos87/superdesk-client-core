MultiImageEditService.$inject = ['$modal', 'authoring'];
export function MultiImageEditService($modal, authoring) {
    this.edit = (data) => {
        $modal.open({
            templateUrl: 'scripts/apps/search/views/multi-image-edit.html',
            controller: ['$scope', 'config', function ($scope, config) {
                    $scope.images = _.clone(data);

                    $scope.validator = config.validatorMediaMetadata;

                    $scope.placeholders = {};

                    $scope.metadata = {
                        headline: compare('headline'),
                        description_text: compare('description_text'),
                        archive_description: compare('archive_description'),
                        alt_text: compare('alt_text'),
                        byline: compare('byline'),
                        copyrightholder: compare('copyrightholder'),
                        usageterms: compare('usageterms'),
                        copyrightnotice: compare('copyrightnotice')
                    };

                    $scope.save = (close) => {
                        let metadata = _.pickBy($scope.metadata, (meta) => {
                            return meta !== '';
                        });

                        angular.forEach($scope.images, (image) => {
                            if (!image.unselected) {
                                authoring.save(image, metadata);
                            }
                        });

                        if (close) {
                            $scope.$close();
                        }
                    };

                    function compare(value) {
                        let uniqueValue = true;

                        angular.forEach($scope.images, (image) => {
                            if ($scope.images[0][value] !== image[value]) {
                                uniqueValue = false;
                            }
                        });

                        if (uniqueValue) {
                            return $scope.images[0][value];
                        }

                        $scope.placeholders[value] = '(multiple values)';

                        return '';
                    }
                }],

            size: 'fullscreen modal--dark-ui'
        });
    };

}